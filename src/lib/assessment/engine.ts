// ====================================================================
// Adaptive assessment engine — deterministic, pure, JSON-safe.
//
// Responsibilities:
//   1. Validate an answer against its question's response type.
//   2. Evaluate a question's branch condition against gathered answers.
//   3. Resolve the next unanswered, relevant question (the branching core).
//
// No DB, no network, no AI. The same input always produces the same
// output, so this is trivially unit-testable (see tests below).
// ====================================================================

import { QUESTION_BANK, getQuestion } from "./bank";
import type {
  AnswerMap,
  AnswerValue,
  AssessmentAnswer,
  BranchCondition,
  Question,
} from "./types";

// --------------------------------------------------------------------
// Branch condition evaluation
// --------------------------------------------------------------------

function resolveAnswer(answers: AnswerMap, questionId: string): AnswerValue {
  return Object.prototype.hasOwnProperty.call(answers, questionId)
    ? answers[questionId]
    : null;
}

/** Evaluate a branch condition against the given answers. */
export function evaluateCondition(
  condition: BranchCondition,
  answers: AnswerMap
): boolean {
  if ("equals" in condition) {
    const { question, value } = condition.equals;
    return resolveAnswer(answers, question) === value;
  }
  if ("anyOf" in condition) {
    const { question, values } = condition.anyOf;
    const current = resolveAnswer(answers, question);
    return values.some((v) => current === v);
  }
  if ("gte" in condition) {
    const { question, value } = condition.gte;
    const current = resolveAnswer(answers, question);
    return typeof current === "number" && current >= value;
  }
  if ("lte" in condition) {
    const { question, value } = condition.lte;
    const current = resolveAnswer(answers, question);
    return typeof current === "number" && current <= value;
  }
  if ("answered" in condition) {
    return resolveAnswer(answers, condition.answered) !== null;
  }
  if ("and" in condition) {
    return condition.and.every((c) => evaluateCondition(c, answers));
  }
  if ("or" in condition) {
    return condition.or.some((c) => evaluateCondition(c, answers));
  }
  if ("not" in condition) {
    return !evaluateCondition(condition.not, answers);
  }
  // Unknown shape — fail closed (don't show a question we can't evaluate).
  return false;
}

/** Whether a question is relevant given the answers gathered so far. */
export function isQuestionRelevant(question: Question, answers: AnswerMap): boolean {
  if (!question.branch) return true;
  return evaluateCondition(question.branch, answers);
}

// --------------------------------------------------------------------
// Answer validation
// --------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Normalised value (e.g. a trimmed string, a boolean, an int). */
  value?: AnswerValue;
}

/** Validate + normalise a raw answer against a question. */
export function validateAnswer(question: Question, raw: unknown): ValidationResult {
  switch (question.responseType) {
    case "single": {
      if (typeof raw !== "string") return { valid: false, error: "Expected a single choice." };
      if (!question.options) return { valid: false, error: "Question has no options." };
      if (!question.options.some((o) => o.value === raw)) {
        return { valid: false, error: "Not one of the available choices." };
      }
      return { valid: true, value: raw };
    }
    case "multi": {
      if (!Array.isArray(raw)) return { valid: false, error: "Expected a list of choices." };
      const values = raw.filter((v): v is string => typeof v === "string");
      if (values.length === 0) return { valid: false, error: "Select at least one." };
      if (!question.options) return { valid: false, error: "Question has no options." };
      const allowed = new Set(question.options.map((o) => o.value));
      if (!values.every((v) => allowed.has(v))) {
        return { valid: false, error: "Contains an invalid choice." };
      }
      return { valid: true, value: values };
    }
    case "scale": {
      if (typeof raw !== "number" && typeof raw !== "string") {
        return { valid: false, error: "Expected a number." };
      }
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isInteger(n)) return { valid: false, error: "Expected a whole number." };
      const min = question.min ?? 1;
      const max = question.max ?? 5;
      if (n < min || n > max) return { valid: false, error: `Must be between ${min} and ${max}.` };
      return { valid: true, value: n };
    }
    case "number": {
      if (typeof raw !== "number" && typeof raw !== "string") {
        return { valid: false, error: "Expected a number." };
      }
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return { valid: false, error: "Expected a number." };
      return { valid: true, value: n };
    }
    case "boolean": {
      if (typeof raw !== "boolean") return { valid: false, error: "Expected yes or no." };
      return { valid: true, value: raw };
    }
    case "text": {
      if (typeof raw !== "string") return { valid: false, error: "Expected text." };
      const trimmed = raw.trim();
      if (trimmed.length === 0) return { valid: false, error: "This can't be empty." };
      if (trimmed.length > 2000) return { valid: false, error: "Too long (max 2000 characters)." };
      return { valid: true, value: trimmed };
    }
    default:
      return { valid: false, error: "Unknown response type." };
  }
}

// --------------------------------------------------------------------
// Next-question resolution (the branching core)
// --------------------------------------------------------------------

export interface NextQuestionResult {
  /** The next relevant question to ask, or null when complete. */
  question: Question | null;
  /** Total relevant questions in this run (for progress display). */
  totalRelevant: number;
  /** Number of relevant questions already answered. */
  answeredRelevant: number;
}

/**
 * Resolve the next question, given the answers so far.
 *
 * Questions are considered in bank order. A question is "relevant" if it
 * has no branch, or its branch holds. The next question is the first
 * relevant question that has not yet been answered. Returns `question:
 * null` once every relevant question is answered (the run is complete).
 */
export function nextQuestion(
  answers: AnswerMap,
  bank = QUESTION_BANK
): NextQuestionResult {
  const relevant = bank.questions.filter((q) => isQuestionRelevant(q, answers));

  let answeredRelevant = 0;
  for (const q of relevant) {
    if (Object.prototype.hasOwnProperty.call(answers, q.id)) {
      answeredRelevant += 1;
      continue;
    }
    return {
      question: q,
      totalRelevant: relevant.length,
      answeredRelevant,
    };
  }

  return {
    question: null,
    totalRelevant: relevant.length,
    answeredRelevant,
  };
}

/** Whether the run is complete (all relevant questions answered). */
export function isAssessmentComplete(answers: AnswerMap, bank = QUESTION_BANK): boolean {
  return nextQuestion(answers, bank).question === null;
}

/** Convert stored responses into a plain answers map for the engine. */
export function answersFromResponses(responses: AssessmentAnswer[]): AnswerMap {
  const map: AnswerMap = {};
  for (const r of responses) {
    map[r.questionId] = r.value;
  }
  return map;
}

/** All questions that are relevant for the given answers (used by tests + debugging). */
export function relevantQuestions(answers: AnswerMap, bank = QUESTION_BANK): Question[] {
  return bank.questions.filter((q) => isQuestionRelevant(q, answers));
}

/** Look up a question by id from the default bank (throws-free). */
export function questionById(id: string): Question | undefined {
  return getQuestion(id);
}

// --------------------------------------------------------------------
// Client-safe question serialisation (drop engine-only metadata)
// --------------------------------------------------------------------

import type { AssessmentSection, QuestionOption, ResponseType } from "./types";

export interface PublicQuestion {
  id: string;
  section: AssessmentSection;
  prompt: string;
  whyAsked: string;
  responseType: ResponseType;
  options?: QuestionOption[];
  min?: number;
  max?: number;
}

/** Strip branch/construct metadata before sending a question to the client. */
export function publicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    section: q.section,
    prompt: q.prompt,
    whyAsked: q.whyAsked,
    responseType: q.responseType,
    options: q.options,
    min: q.min,
    max: q.max,
  };
}
