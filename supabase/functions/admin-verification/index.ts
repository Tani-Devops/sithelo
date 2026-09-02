// ====================================================================
// admin-verification
// Admin-only action: approve or reject a specific verification record.
//
// SECURITY FIX: the previous version accepted `admin_id` in the request
// body and used it directly as the actor — meaning any authenticated
// caller could pass any UUID and have it recorded (and acted on) as an
// admin decision. There was no check that the caller actually *was* that
// admin, or an admin at all. This version verifies the caller's identity
// from their Supabase JWT and looks up their role server-side via
// requireRole(); the body no longer contains admin_id at all, because it
// was never trustworthy input to begin with.
//
// Invoke: POST { verification_id, decision: 'approve'|'reject', notes? }
// Authorization: Bearer <the calling admin's Supabase access token>
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireRole } from "../_shared/auth.ts";
import { adminVerificationSchema, parseBody } from "../_shared/schemas.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id; // the ONLY trustworthy source of "who is acting"

  try {
    const parsed = await parseBody(req, adminVerificationSchema);
    if (parsed instanceof Response) return parsed;
    const { verification_id, decision, notes } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: verification, error: findErr } = await supabase
      .from("verifications")
      .select("*, business_passports!inner(id, owner_id)")
      .eq("id", verification_id)
      .single();
    if (findErr || !verification) return json({ error: "Verification not found" }, 404);

    const newStatus = decision === "approve" ? "verified" : "rejected";

    const { error: updateErr } = await supabase
      .from("verifications")
      .update({ status: newStatus, verified_by: adminId, verified_at: new Date().toISOString(), notes })
      .eq("id", verification_id);
    if (updateErr) throw updateErr;

    const passportId = (verification as { business_passports: { id: string; owner_id: string } }).business_passports.id;
    const ownerId = (verification as { business_passports: { id: string; owner_id: string } }).business_passports.owner_id;

    await fetch(`${supabaseUrl}/functions/v1/calculate-trust-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({ passport_id: passportId }),
    });

    await supabase.from("audit_logs").insert({
      actor_id: adminId,
      action: `verification.${decision}`,
      entity_type: "verification",
      entity_id: verification_id,
      changes: { status: newStatus, notes },
      ip_address: req.headers.get("x-forwarded-for") ?? null,
    });

    await supabase.from("notifications").insert({
      recipient_id: ownerId,
      category: "verification",
      title: decision === "approve" ? "A verification was approved" : "A verification needs attention",
      body:
        decision === "approve"
          ? `Your ${verification.verification_type.toUpperCase()} verification has been approved.`
          : `Your ${verification.verification_type.toUpperCase()} verification was rejected. ${notes ?? ""}`.trim(),
      metadata: { passport_id: passportId, verification_id },
    });

    await supabase.from("passport_activity").insert({
      passport_id: passportId,
      activity_type: "verification_updated",
      description: `${verification.verification_type.toUpperCase()} verification ${newStatus}`,
    });

    return json({ ok: true, verification_id, status: newStatus });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
