// ====================================================================
// calculate-trust-score
// Recalculates Trust Score, Business Health, Readiness Score and
// Profile Completeness for a Business Passport whenever relevant data
// changes (verification updated, document uploaded, application outcome).
//
// Invoke: POST { passport_id: string }
// Trigger this from DB webhooks on verifications/documents/applications,
// or call it directly after any passport-affecting write.
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { calculateTrustScoreSchema, parseBody } from "../_shared/schemas.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// SECURITY: internal-only. Requires the caller to present the service-role
// key as bearer auth, so only other edge functions / trusted server-side
// Route Handlers can invoke this — never a browser client directly.

// Weighting is intentionally explicit and documented rather than a black box,
// since institutions and entrepreneurs both need to understand what moves the score.
const VERIFICATION_WEIGHTS: Record<string, number> = {
  cipc: 15,
  sars: 15,
  vat: 10,
  bbbee: 10,
  cidb: 10,
  municipal_supplier: 10,
  insurance: 10,
  bank: 10,
};
const MAX_VERIFICATION_POINTS = Object.values(VERIFICATION_WEIGHTS).reduce((a, b) => a + b, 0); // 90

const PROFILE_FIELDS = [
  "business_description", "core_services", "equipment_owned", "capacity_range",
  "employees_count", "annual_turnover", "years_trading", "website",
  "business_email", "business_phone", "logo_url",
];

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "This function is internal-only" }, 403);
  }

  try {
    const parsed = await parseBody(req, calculateTrustScoreSchema);
    if (parsed instanceof Response) return parsed;
    const { passport_id } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: passport, error: passportErr } = await supabase
      .from("business_passports")
      .select("*")
      .eq("id", passport_id)
      .single();
    if (passportErr || !passport) return json({ error: "Passport not found" }, 404);

    const { data: verifications } = await supabase
      .from("verifications")
      .select("verification_type, status, expiry_date")
      .eq("passport_id", passport_id);

    const { data: documents } = await supabase
      .from("documents")
      .select("status")
      .eq("passport_id", passport_id);

    const { data: applications } = await supabase
      .from("applications")
      .select("status")
      .eq("passport_id", passport_id);

    // ---- Verification score (0-90) ----
    let verificationPoints = 0;
    const today = new Date();
    for (const v of verifications ?? []) {
      const weight = VERIFICATION_WEIGHTS[v.verification_type] ?? 0;
      if (v.status === "verified") {
        const expired = v.expiry_date ? new Date(v.expiry_date) < today : false;
        verificationPoints += expired ? weight * 0.4 : weight; // decays if expired, not zeroed
      }
    }
    const verificationScore = Math.round((verificationPoints / MAX_VERIFICATION_POINTS) * 90);

    // ---- Track record bonus (0-10), from won applications ----
    const won = (applications ?? []).filter((a) => a.status === "awarded").length;
    const trackRecordBonus = Math.min(10, won * 2);

    const trustScore = Math.max(0, Math.min(100, verificationScore + trackRecordBonus));

    // ---- Profile completeness (0-100) ----
    let filled = 0;
    for (const field of PROFILE_FIELDS) {
      if ((passport as Record<string, unknown>)[field]) filled++;
    }
    const profileCompleteness = Math.round((filled / PROFILE_FIELDS.length) * 100);

    // ---- Business health (0-100): blends verification, documents in good standing, completeness ----
    const validDocs = (documents ?? []).filter((d) => d.status === "valid").length;
    const totalDocs = (documents ?? []).length;
    const docHealth = totalDocs > 0 ? (validDocs / totalDocs) * 100 : 50;
    const businessHealthScore = Math.round(trustScore * 0.5 + docHealth * 0.3 + profileCompleteness * 0.2);

    // ---- Readiness for opportunities (0-100): requires baseline verification + complete profile ----
    const readinessScore = Math.round(
      trustScore >= 60 ? Math.min(100, trustScore * 0.7 + profileCompleteness * 0.3) : trustScore * 0.5
    );

    const overallStatus =
      trustScore >= 70 ? "verified" : trustScore >= 30 ? "pending" : "unverified";

    const { error: updateErr } = await supabase
      .from("business_passports")
      .update({
        trust_score: trustScore,
        business_health_score: businessHealthScore,
        readiness_score: readinessScore,
        profile_completeness: profileCompleteness,
        overall_verification_status: overallStatus,
      })
      .eq("id", passport_id);
    if (updateErr) throw updateErr;

    await supabase.from("trust_score_history").insert({ passport_id, score: trustScore });

    return json({
      passport_id,
      trust_score: trustScore,
      business_health_score: businessHealthScore,
      readiness_score: readinessScore,
      profile_completeness: profileCompleteness,
      overall_verification_status: overallStatus,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
