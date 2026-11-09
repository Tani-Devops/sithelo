// ====================================================================
// POST /api/persona/recompute
//
// The sole write path for public.entrepreneur_persona_state — the
// migration (025) revokes authenticated INSERT/UPDATE on that table
// entirely, so this route (service-role, after its own auth check)
// is the only way a row lands there. Mirrors the proxy pattern
// already used by /api/documents/[id]/signed-url: authenticate with
// the session-bound client, then do privileged reads/writes with the
// service client after our own authorization check.
//
// Actual computation lives in src/lib/persona/recompute.ts, shared
// with the onboarding-completion route so a fresh persona is computed
// in the same request that finishes onboarding, not a second round trip.
// ====================================================================
import { NextResponse } from "next/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rateLimit";
import { createServiceClient } from "@/lib/supabase/service";
import { recomputePersonaForUser } from "@/lib/persona/recompute";

export async function POST() {
  const { userId } = await requireEntrepreneur();
  const supabase = createServiceClient();

  const limitResponse = await enforceRateLimit(
    supabase,
    `persona-recompute:${userId}`,
    20,
    3600,
    "Too many requests. Please try again shortly."
  );
  if (limitResponse) return limitResponse;

  const result = await recomputePersonaForUser(supabase, userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ persona: result.persona, next_step: result.next_step });
}
