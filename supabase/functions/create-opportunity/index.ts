// ====================================================================
// create-opportunity
// Creates an opportunity, then triggers match-businesses and notifies
// matched entrepreneurs.
//
// SECURITY FIX: previously accepted `institution_id` and `created_by` in
// the body and trusted them outright — a caller from Institution A could
// pass Institution B's id and post opportunities on their behalf, or
// forge `created_by` for audit purposes. Now the caller's institution_id
// and user id come only from their verified profile; the body's
// institution_id (if present) is ignored in favor of the verified one.
//
// Invoke: POST { title, opportunity_type, ...other opportunity fields }
// Authorization: Bearer <the calling institution user's access token>
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireRole } from "../_shared/auth.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { createOpportunitySchema, parseBody } from "../_shared/schemas.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTIFY_THRESHOLD = 65;

Deno.serve(async (req) => {
  const auth = await requireRole(req, ["institution", "admin"]);
  if (!auth.ok) return auth.response;

  if (!auth.user.institutionId && auth.user.role !== "admin") {
    return json({ error: "Your account isn't linked to an institution yet. Complete institution onboarding first." }, 403);
  }

  const allowed = await checkRateLimit(`create-opportunity:${auth.user.id}`, 30, 3600, true); // fail closed — see _shared/rateLimit.ts
  if (!allowed) return rateLimitResponse();

  try {
    const parsed = await parseBody(req, createOpportunitySchema);
    if (parsed instanceof Response) return parsed;
    const { title, opportunity_type, institution_id: bodyInstitutionId, ...rest } = parsed;

    // Admins may specify institution_id explicitly (e.g. seeding on an
    // institution's behalf); institution users always use their own,
    // regardless of what the body says.
    const institutionId = auth.user.role === "admin" ? (bodyInstitutionId ?? auth.user.institutionId) : auth.user.institutionId;
    if (!institutionId) return json({ error: "institution_id is required" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: opportunity, error: insertErr } = await supabase
      .from("opportunities")
      .insert({ ...rest, title, opportunity_type, institution_id: institutionId, created_by: auth.user.id, status: rest.status ?? "active" })
      .select()
      .single();
    if (insertErr) throw insertErr;

    const matchRes = await fetch(`${supabaseUrl}/functions/v1/match-businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({ opportunity_id: opportunity.id }),
    });
    const matchData = await matchRes.json();

    const strongMatches = (matchData.matches ?? []).filter((m: { match_score: number }) => m.match_score >= NOTIFY_THRESHOLD);
    if (strongMatches.length > 0) {
      const { data: owners } = await supabase
        .from("business_passports")
        .select("id, owner_id")
        .in("id", strongMatches.map((m: { passport_id: string }) => m.passport_id));

      const notifications = (owners ?? []).map((o) => ({
        recipient_id: o.owner_id,
        category: "invitation",
        title: "New opportunity matches your business",
        body: `"${title}" is a strong match for your Business Passport.`,
        metadata: { opportunity_id: opportunity.id, passport_id: o.id },
      }));
      if (notifications.length > 0) await supabase.from("notifications").insert(notifications);
    }

    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      action: "opportunity.created",
      entity_type: "opportunity",
      entity_id: opportunity.id,
      ip_address: req.headers.get("x-forwarded-for") ?? null,
    });

    return json({ opportunity, matches_found: matchData.total_matches ?? 0, notified: strongMatches.length });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
