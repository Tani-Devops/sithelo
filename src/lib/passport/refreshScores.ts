// Recomputes a passport's trust score, profile completeness and
// opportunity matches by invoking the internal calculate-trust-score
// edge function (which re-runs matching itself).
//
// Callers must have already verified that the current user may act on
// this passport — this uses the service role and trusts the id it is
// given. Failures are logged, never thrown: the scores are derived data
// and the user's own write has already succeeded by the time this runs.
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export async function refreshPassportScores(passportId: string): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service.functions.invoke("calculate-trust-score", {
      body: { passport_id: passportId },
    });
    if (error) console.error("refreshPassportScores failed:", error.message);
  } catch (err) {
    console.error("refreshPassportScores failed:", err instanceof Error ? err.message : err);
  }
}
