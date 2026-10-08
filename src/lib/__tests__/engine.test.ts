// ====================================================================
// Adaptive assessment engine tests — branching, relevance, completion.
// ====================================================================
import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  isAssessmentComplete,
  isQuestionRelevant,
  nextQuestion,
  validateAnswer,
} from "../assessment/engine";
import { getQuestion } from "../assessment/bank";
import type { AnswerMap } from "../assessment/types";

describe("branching — irrelevant questions are skipped", () => {
  it("skips business-money questions when the business earns nothing", () => {
    const answers = { e_earns_money: false };
    const customers = getQuestion("e_customers")!;
    const income = getQuestion("f_business_income_range")!;
    expect(isQuestionRelevant(customers, answers)).toBe(false);
    expect(isQuestionRelevant(income, answers)).toBe(false);
  });

  it("shows business-money questions when earning", () => {
    const answers = { e_earns_money: true };
    const customers = getQuestion("e_customers")!;
    expect(isQuestionRelevant(customers, answers)).toBe(true);
  });

  it("only asks employment-dependence questions for employed people", () => {
    const incomeDependence = getQuestion("c_income_dependence")!;
    expect(isQuestionRelevant(incomeDependence, { a_employment_status: "full_time_employed" })).toBe(true);
    expect(isQuestionRelevant(incomeDependence, { a_employment_status: "self_employed_full" })).toBe(false);
  });
});

describe("nextQuestion resolution", () => {
  it("returns the first unanswered relevant question", () => {
    const result = nextQuestion({});
    expect(result.question).not.toBeNull();
    expect(result.question!.id).toBe("a_province");
    expect(result.answeredRelevant).toBe(0);
  });

  it("only ever returns questions that are relevant to the current answers", () => {
    const answers: AnswerMap = {};
    let result = nextQuestion(answers);
    let guard = 0;
    const seen: string[] = [];
    while (result.question && guard < 200) {
      const q = result.question;
      seen.push(q.id);
      // The question returned must be relevant given what we've answered.
      expect(isQuestionRelevant(q, answers)).toBe(true);
      // Answer it with a valid value for its type so branching can proceed.
      answers[q.id] = validAnswerFor(q);
      result = nextQuestion(answers);
      guard += 1;
    }
    expect(seen.length).toBeGreaterThan(0);
    // The adaptive run terminates (all relevant questions answered).
    expect(isAssessmentComplete(answers)).toBe(true);
  });

  it("reaches completion once all relevant questions are answered", () => {
    const answers = { e_earns_money: false };
    // Only answer the two questions whose branches we can satisfy; the rest
    // are still open, so this must NOT be complete.
    expect(isAssessmentComplete(answers)).toBe(false);
  });
});

describe("answer validation", () => {
  it("accepts a valid single choice", () => {
    const q = getQuestion("e_formalisation")!;
    const r = validateAnswer(q, "informal");
    expect(r.valid).toBe(true);
    expect(r.value).toBe("informal");
  });

  it("rejects an unknown single choice", () => {
    const q = getQuestion("e_formalisation")!;
    expect(validateAnswer(q, "nonsense").valid).toBe(false);
  });

  it("accepts a valid scale value and rejects out-of-range", () => {
    const q = getQuestion("j_record_keeping")!;
    expect(validateAnswer(q, 4).valid).toBe(true);
    expect(validateAnswer(q, 9).valid).toBe(false);
  });

  it("rejects a non-boolean for a boolean question", () => {
    const q = getQuestion("e_earns_money")!;
    expect(validateAnswer(q, "yes").valid).toBe(false);
    expect(validateAnswer(q, true).valid).toBe(true);
  });
});

describe("branch condition evaluation", () => {
  it("evaluates equals, anyOf, and, not, gte correctly", () => {
    const answers = { e_earns_money: true, j_record_keeping: 5 };
    expect(evaluateCondition({ equals: { question: "e_earns_money", value: true } }, answers)).toBe(true);
    expect(evaluateCondition({ anyOf: { question: "j_record_keeping", values: [1, 2, 5] } }, answers)).toBe(true);
    expect(evaluateCondition({ gte: { question: "j_record_keeping", value: 4 } }, answers)).toBe(true);
    expect(evaluateCondition({ not: { equals: { question: "e_earns_money", value: false } } }, answers)).toBe(true);
    expect(
      evaluateCondition(
        { and: [{ equals: { question: "e_earns_money", value: true } }, { gte: { question: "j_record_keeping", value: 4 } }] },
        answers
      )
    ).toBe(true);
  });
});

function validAnswerFor(q: { responseType: string; options?: { value: string }[]; min?: number }): string | number | boolean | string[] {
  switch (q.responseType) {
    case "boolean":
      return true;
    case "scale":
    case "number":
      return q.min ?? 3;
    case "multi":
      return q.options?.length ? [q.options[0].value] : [];
    case "text":
      return "test answer";
    default:
      return q.options?.[0]?.value ?? "x";
  }
}
