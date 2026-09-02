// ====================================================================
// match-businesses
// Ranks published, verified Business Passports against an opportunity's
// requirements. Writes results to `matches` and returns them ranked.
//
// Invoke: POST { opportunity_id: string }
// Call this from create-opportunity after insert, and on demand when an
// institution reopens the "Matches" tab for a live requirement.
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { matchBusinessesSchema, parseBody } from "../_shared/schemas.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// SECURITY: internal-only. Requires the caller to present the service-role
// key as bearer auth, so only other edge functions / trusted server-side
// Route Handlers can invoke this — never a browser client directly.

interface Requirements {
  industry?: string;
  province?: string;
  min_trust_score?: number;
  min_bbbee_level?: number; // lower is better (Level 1 > Level 4), so "min" means "at least this good"
  min_years_trading?: number;
}

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "This function is internal-only" }, 403);
  }

  try {
    const parsed = await parseBody(req, matchBusinessesSchema);
    if (parsed instanceof Response) return parsed;
    const { opportunity_id } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunity_id)
      .single();
    if (oppErr || !opp) return json({ error: "Opportunity not found" }, 404);

    const req_: Requirements = opp.requirements ?? {};

    // Start from published, verified passports only — unpublished/unverified businesses
    // never surface in institution search or matching, by design.
    let query = supabase
      .from("business_passports")
      .select("*")
      .eq("is_published", true)
      .gte("trust_score", req_.min_trust_score ?? 0);

    if (opp.province) query = query.eq("province", opp.province);

    const { data: candidates, error: candErr } = await query;
    if (candErr) throw candErr;

    const results = (candidates ?? []).map((biz) => {
      let score = 0;
      const reasons: string[] = [];

      // Industry match (0-40)
      if (req_.industry && biz.industry === req_.industry) {
        score += 40;
        reasons.push("Exact industry match");
      } else if (req_.industry && biz.sub_industry === req_.industry) {
        score += 25;
        reasons.push("Related industry match");
      }

      // Location match (0-20) — province already filtered, so score on municipality precision
      if (opp.municipality && biz.municipality === opp.municipality) {
        score += 20;
        reasons.push("Same municipality");
      } else if (opp.province && biz.province === opp.province) {
        score += 12;
        reasons.push("Same province");
      }

      // Trust score contribution (0-25)
      score += Math.round((biz.trust_score / 100) * 25);

      // BBBEE level (0-10) — level 1 is best
      if (req_.min_bbbee_level && biz.bbbee_level && biz.bbbee_level <= req_.min_bbbee_level) {
        score += 10;
        reasons.push(`B-BBEE Level ${biz.bbbee_level} meets requirement`);
      }

      // Years trading (0-5)
      if (req_.min_years_trading && biz.years_trading && biz.years_trading >= req_.min_years_trading) {
        score += 5;
        reasons.push("Meets minimum years trading");
      }

      const tier = score >= 85 ? "exact" : score >= 65 ? "high" : score >= 40 ? "good" : "partial";

      return { passport_id: biz.id, match_score: Math.min(100, score), match_tier: tier, match_reasons: reasons };
    })
    // Only persist genuinely relevant matches
    .filter((m) => m.match_score >= 20)
    .sort((a, b) => b.match_score - a.match_score);

    if (results.length > 0) {
      const rows = results.map((r) => ({ opportunity_id, ...r }));
      const { error: upsertErr } = await supabase
        .from("matches")
        .upsert(rows, { onConflict: "opportunity_id,passport_id" });
      if (upsertErr) throw upsertErr;
    }

    return json({ opportunity_id, total_matches: results.length, matches: results.slice(0, 50) });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
