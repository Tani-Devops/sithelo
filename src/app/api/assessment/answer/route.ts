// ====================================================================
// POST /api/assessment/answer
//
// Validates and stores a single answer for the authenticated
// entrepreneur's assessment, then resolves and returns the next question.
// Writes via the session-bound client so RLS enforces ownership; answer
// values are validated against the question's response type server-side.
// ====================================================================
import { NextResponse } from "next/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  answersFromResponses,
  nextQuestion,
  publicQuestion,
  validateAnswer,
} from "@/lib/assessment/engine";
import { getQuestion } from "@/lib/assessment/bank";
import type { AssessmentAnswer } from "@/lib/assessment/types";

interface AnswerBody {
  assessment_id?: string;
  question_id?: string;
  answer?: unknown;
}

export async function POST(req: Request) {
  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();

  let body: AnswerBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const assessmentId = typeof body.assessment_id === "string" ? body.assessment_id : "";
  const questionId = typeof body.question_id === "string" ? body.question_id : "";
  if (!assessmentId || !questionId) {
    return NextResponse.json({ error: "assessment_id and question_id are required." }, { status: 400 });
  }

  // Ownership check (RLS also enforces this, but fail with a clear message).
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status")
    .eq("id", assessmentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }
  if (assessment.status === "completed") {
    return NextResponse.json({ error: "This assessment is already complete." }, { status: 409 });
  }

  const question = getQuestion(questionId);
  if (!question) {
    return NextResponse.json({ error: "Unknown question." }, { status: 400 });
  }

  const result = validateAnswer(question, body.answer);
  if (!result.valid || result.value === undefined) {
    return NextResponse.json({ error: result.error ?? "Invalid answer." }, { status: 400 });
  }

  // Upsert the answer (unique on assessment_id + question_id).
  const { error: upsertError } = await supabase
    .from("assessment_responses")
    .upsert(
      {
        assessment_id: assessmentId,
        question_id: questionId,
        answer: result.value,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id,question_id" }
    );
  if (upsertError) {
    return NextResponse.json({ error: "Could not save your answer." }, { status: 500 });
  }

  // Resolve the next question.
  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("question_id, answer, answered_at")
    .eq("assessment_id", assessmentId);

  const answers = answersFromResponses(responses as unknown as AssessmentAnswer[] | null ?? []);
  const next = nextQuestion(answers);

  return NextResponse.json({
    question: next.question ? publicQuestion(next.question) : null,
    total_relevant: next.totalRelevant,
    answered_relevant: next.answeredRelevant,
    complete: next.question === null,
  });
}
