// ====================================================================
// match-businesses
// Scores published Business Passports against opportunity requirements
// and writes the results to `matches`. Two directions, same scoring:
//
//   POST { opportunity_id }  one opportunity  x  every published passport
//                            (called by create-opportunity)
//   POST { passport_id }     one passport     x  every active opportunity
//                            (called by calculate-trust-score, so a
//                            business that publishes or improves after an
//                            opportunity was created still gets matched)
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { matchBusinessesSchema, parseBody } from "../_shared/schemas.ts";
import { safeErrorMessage } from "../_shared/errors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Matches scoring below this are not stored.
const MIN_STORED_SCORE = 20;

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

interface OpportunityRow {
  id: string;
  province: string | null;
  municipality: string | null;
  requirements: Requirements | null;
}

interface PassportRow {
  id: string;
  industry: string | null;
  sub_industry: string | null;
  province: string | null;
  municipality: string | null;
  trust_score: number;
  bbbee_level: number | null;
  years_trading: number | null;
}

interface MatchRow {
  opportunity_id: string;
  passport_id: string;
  match_score: number;
  match_tier: string;
  match_reasons: string[];
}

const OPPORTUNITY_COLUMNS = "id, province, municipality, requirements";
const PASSPORT_COLUMNS = "id, industry, sub_industry, province, municipality, trust_score, bbbee_level, years_trading";

/**
 * Scores one passport against one opportunity. Returns null when the
 * pair is excluded outright (wrong province, below the minimum trust
 * score) or scores too low to be worth storing.
 */
function scoreMatch(opp: OpportunityRow, biz: PassportRow): MatchRow | null {
  const reqs: Requirements = opp.requirements ?? {};

  if (opp.province && biz.province !== opp.province) return null;
  if (biz.trust_score < (reqs.min_trust_score ?? 0)) return null;

  let score = 0;
  const reasons: string[] = [];

  // Industry fit (up to 40 points)
  if (reqs.industry && biz.industry === reqs.industry) {
    score += 40;
    reasons.push("Exact industry match");
  } else if (reqs.industry && biz.sub_industry === reqs.industry) {
    score += 25;
    reasons.push("Related industry match");
  }

  // Location fit (up to 20 points)
  if (opp.municipality && biz.municipality === opp.municipality) {
    score += 20;
    reasons.push("Same municipality");
  } else if (opp.province && biz.province === opp.province) {
    score += 12;
    reasons.push("Same province");
  }

  // Trust score contribution (up to 25 points)
  score += Math.round((biz.trust_score / 100) * 25);

  // B-BBEE (up to 10 points)
  if (reqs.min_bbbee_level && biz.bbbee_level && biz.bbbee_level <= reqs.min_bbbee_level) {
    score += 10;
    reasons.push(`B-BBEE Level ${biz.bbbee_level} meets requirement`);
  }

  // Track record (up to 5 points)
  if (reqs.min_years_trading && biz.years_trading && biz.years_trading >= reqs.min_years_trading) {
    score += 5;
    reasons.push("Meets minimum years trading");
  }

  if (score < MIN_STORED_SCORE) return null;

  const tier = score >= 85 ? "exact" : score >= 65 ? "high" : score >= 40 ? "good" : "partial";
  return {
    opportunity_id: opp.id,
    passport_id: biz.id,
    match_score: Math.min(100, score),
    match_tier: tier,
    match_reasons: reasons,
  };
}

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "This function is internal-only" }, 403);
  }

  try {
    const parsed = await parseBody(req, matchBusinessesSchema);
    if (parsed instanceof Response) return parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let results: MatchRow[] = [];

    if (parsed.opportunity_id) {
      const { data: opp, error: oppErr } = await supabase
        .from("opportunities")
        .select(OPPORTUNITY_COLUMNS)
        .eq("id", parsed.opportunity_id)
        .single();
      if (oppErr || !opp) return json({ error: "Opportunity not found" }, 404);

      // Published passports only — unpublished businesses never surface
      // in institution search or matching, by design.
      const { data: candidates, error: candErr } = await supabase
        .from("business_passports")
        .select(PASSPORT_COLUMNS)
        .eq("is_published", true);
      if (candErr) throw candErr;

      results = ((candidates ?? []) as PassportRow[])
        .map((biz) => scoreMatch(opp as OpportunityRow, biz))
        .filter((m): m is MatchRow => m !== null);
    } else {
      const { data: passport, error: passportErr } = await supabase
        .from("business_passports")
        .select(`${PASSPORT_COLUMNS}, is_published`)
        .eq("id", parsed.passport_id!)
        .single();
      if (passportErr || !passport) return json({ error: "Passport not found" }, 404);

      if (!passport.is_published) {
        return json({ passport_id: parsed.passport_id, total_matches: 0, matches: [] });
      }

      const { data: opportunities, error: oppsErr } = await supabase
        .from("opportunities")
        .select(OPPORTUNITY_COLUMNS)
        .eq("status", "active");
      if (oppsErr) throw oppsErr;

      results = ((opportunities ?? []) as OpportunityRow[])
        .map((opp) => scoreMatch(opp, passport as PassportRow))
        .filter((m): m is MatchRow => m !== null);
    }

    results.sort((a, b) => b.match_score - a.match_score);

    if (results.length > 0) {
      const { error: upsertErr } = await supabase
        .from("matches")
        .upsert(results, { onConflict: "opportunity_id,passport_id" });
      if (upsertErr) throw upsertErr;
    }

    return json({
      opportunity_id: parsed.opportunity_id ?? null,
      passport_id: parsed.passport_id ?? null,
      total_matches: results.length,
      matches: results.slice(0, 50),
    });
  } catch (err) {
    console.error(err);
    return json({ error: safeErrorMessage(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
