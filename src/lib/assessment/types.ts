// ====================================================================
// Assessment domain types — the data model for the adaptive
// Sithelo Entrepreneurial Journey Assessment (directive §4-§5).
//
// Everything here is serialisable (JSON-safe) so it can be persisted to
// assessment_definitions.definition / assessment_responses.answer and
// reconstructed exactly. No functions, no Dates, no classes.
// ====================================================================

/** Assessment section (A–L per the spec). */
export type AssessmentSection =
  | "A" // Me
  | "B" // My Life
  | "C" // My Relationship With Work
  | "D" // My Entrepreneurial Story
  | "E" // My Business
  | "F" // My Money
  | "G" // My Future
  | "H" // My Behaviour
  | "I" // My Access
  | "J" // My Capability
  | "K" // My Support Needs
  | "L" // My Opportunity Readiness;

export const SECTION_TITLES: Record<AssessmentSection, string> = {
  A: "About you",
  B: "Your life",
  C: "Your relationship with work",
  D: "Your entrepreneurial story",
  E: "Your business",
  F: "Your money",
  G: "Your future",
  H: "How you make decisions",
  I: "Your access",
  J: "Your capability",
  K: "How you like to be supported",
  L: "Opportunities you're interested in",
};

/** The value types an answer can hold. */
export type AnswerValue = string | number | boolean | string[] | null;

/** How a question is answered. */
export type ResponseType = "single" | "multi" | "scale" | "number" | "boolean" | "text";

/** A selectable option. */
export interface QuestionOption {
  value: string;
  label: string;
}

/**
 * A branch condition evaluated against the answers gathered so far.
 * Deterministic and JSON-serialisable — the same shape the DB stores in
 * assessment_definitions.definition.branch_conditions.
 */
export type BranchCondition =
  | { equals: { question: string; value: string | number | boolean } }
  | { anyOf: { question: string; values: Array<string | number | boolean> } }
  | { gte: { question: string; value: number } }
  | { lte: { question: string; value: number } }
  | { answered: string }
  | { and: BranchCondition[] }
  | { or: BranchCondition[] }
  | { not: BranchCondition };

/** A single question in the bank. */
export interface Question {
  /** Stable slug, e.g. `e_earns_money`. Used as the response key. */
  id: string;
  section: AssessmentSection;
  prompt: string;
  /** Plain-language explanation of why this question is asked (consent / §17). */
  whyAsked: string;
  responseType: ResponseType;
  options?: QuestionOption[];
  /** For scale / number. */
  min?: number;
  max?: number;
  /** Show this question only if this condition holds against prior answers. */
  branch?: BranchCondition;
  /** Constructs this question measures (documentation + classification hooks). */
  constructs?: string[];
  /** Which journey-stage signals this answer feeds. */
  stageSignals?: string[];
  /** Which context dimensions this answer affects. */
  dimensions?: string[];
  /** Access/risk flags this answer can raise. */
  flags?: string[];
  /** Opportunity-readiness implications. */
  readiness?: string[];
}

/** A full versioned question bank. */
export interface QuestionBank {
  frameworkVersion: string;
  questions: Question[];
}

/** A single stored answer. */
export interface AssessmentAnswer {
  questionId: string;
  value: AnswerValue;
  answeredAt: string;
}

/** The answers map used by the engine and classifier. */
export type AnswerMap = Record<string, AnswerValue>;

export type AssessmentStatus = "in_progress" | "completed" | "abandoned";
