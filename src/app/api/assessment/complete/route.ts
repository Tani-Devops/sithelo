// ====================================================================
// POST /api/assessment/complete
//
// Finalises the assessment: runs the deterministic two-layer
// classification and persists the snapshot, journey history and current
// persona state (service-role only, after verifying ownership with the
// session-bound client). Returns the full journey profile.
// ====================================================================
import { NextResponse } from "next/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { answersFromResponses, isAssessmentComplete } from "@/lib/assessment/engine";
import { completeAndPersistJourney } from "@/lib/assessment/persist";
import type { AssessmentAnswer } from "@/lib/assessment/types";

interface CompleteBody {
  assessment_id?: string;
}

export async function POST(req: Request) {
  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();

  let body: CompleteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const assessmentId = typeof body.assessment_id === "string" ? body.assessment_id : "";
  if (!assessmentId) {
    return NextResponse.json({ error: "assessment_id is required." }, { status: 400 });
  }

  // Ownership check with the session client.
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status")
    .eq("id", assessmentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("question_id, answer, answered_at")
    .eq("assessment_id", assessmentId);

  const answers = answersFromResponses(responses as unknown as AssessmentAnswer[] | null ?? []);

  if (!isAssessmentComplete(answers)) {
    return NextResponse.json({ error: "Please answer all the questions shown to you first." }, { status: 409 });
  }

  // Classify + persist with the service client (the only write path for
  // snapshots/history/persona_state).
  const service = createServiceClient();
  const result = await completeAndPersistJourney(service, userId, assessmentId, answers);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    profile: result.profile,
    assessment_id: assessmentId,
  });
}
