// ====================================================================
// POST /api/assessment/start
//
// Starts (or resumes) the adaptive Sithelo Entrepreneurial Journey
// Assessment for the authenticated entrepreneur. Returns the assessment
// id and the first (or next) question. Writes via the session-bound
// client so RLS enforces ownership.
// ====================================================================
import { NextResponse } from "next/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { FRAMEWORK_VERSION } from "@/lib/assessment/bank";
import { answersFromResponses, nextQuestion, publicQuestion } from "@/lib/assessment/engine";
import type { AssessmentAnswer } from "@/lib/assessment/types";

export async function POST() {
  const { userId } = await requireEntrepreneur();

  // Rate limit (check_rate_limit is service-role-only, so it needs the
  // service client — same pattern as /api/documents/upload).
  const service = createServiceClient();
  const limitResponse = await enforceRateLimit(
    service,
    `assessment-start:${userId}`,
    30,
    3600,
    "Too many attempts. Please wait a moment and try again."
  );
  if (limitResponse) return limitResponse;

  const supabase = await createClient();

  // Resume the most recent in-progress assessment, if any.
  const { data: existing } = await supabase
    .from("assessments")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let assessmentId = existing?.id as string | undefined;

  if (!assessmentId) {
    const { data: created, error } = await supabase
      .from("assessments")
      .insert({ user_id: userId, framework_version: FRAMEWORK_VERSION, status: "in_progress" })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "Could not start the assessment." }, { status: 500 });
    }
    assessmentId = (created as { id: string }).id;
  }

  // Load existing responses (if resuming) and resolve the next question.
  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("question_id, answer, answered_at")
    .eq("assessment_id", assessmentId);

  const answers = answersFromResponses(responses as unknown as AssessmentAnswer[] | null ?? []);
  const next = nextQuestion(answers);

  return NextResponse.json({
    assessment_id: assessmentId,
    framework_version: FRAMEWORK_VERSION,
    question: next.question ? publicQuestion(next.question) : null,
    total_relevant: next.totalRelevant,
    answered_relevant: next.answeredRelevant,
    complete: next.question === null,
  });
}
