// ====================================================================
// compliance-monitor
// Scheduled function (wire to a Supabase cron trigger, e.g. daily at
// 06:00 SAST) that scans verifications for expired/expiring documents
// and notifies affected business owners.
//
// Invoke: POST {}  (no body needed — scans the whole table)
// Schedule via `supabase functions deploy compliance-monitor --no-verify-jwt`
// and a pg_cron job calling it, documented in SUPABASE_SETUP.md.
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// SECURITY: internal-only. Requires the caller to present the service-role
// key as bearer auth, so only other edge functions / trusted server-side
// Route Handlers can invoke this — never a browser client directly.
const WARNING_WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "This function is internal-only" }, 403);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date();
    const warningDate = new Date(today.getTime() + WARNING_WINDOW_DAYS * 86400000);

    const { data: expiring, error } = await supabase
      .from("verifications")
      .select("id, verification_type, expiry_date, passport_id, business_passports!inner(owner_id, business_name)")
      .eq("status", "verified")
      .not("expiry_date", "is", null)
      .lte("expiry_date", warningDate.toISOString().slice(0, 10));
    if (error) throw error;

    let expiredCount = 0;
    let expiringCount = 0;
    const notifications = [];

    for (const v of expiring ?? []) {
      const expiryDate = new Date(v.expiry_date);
      const isExpired = expiryDate < today;
      isExpired ? expiredCount++ : expiringCount++;

      const owner = (v as unknown as { business_passports: { owner_id: string; business_name: string } }).business_passports;
      notifications.push({
        recipient_id: owner.owner_id,
        category: "document_expiry",
        title: isExpired
          ? `${v.verification_type.toUpperCase()} has expired`
          : `${v.verification_type.toUpperCase()} expires soon`,
        body: isExpired
          ? `Your ${v.verification_type.toUpperCase()} verification for ${owner.business_name} expired on ${v.expiry_date}. Renew it to keep your Trust Score healthy.`
          : `Your ${v.verification_type.toUpperCase()} verification for ${owner.business_name} expires on ${v.expiry_date}.`,
        metadata: { passport_id: v.passport_id, verification_id: v.id },
      });

      // Downgrade status so calculate-trust-score reflects it correctly
      if (isExpired) {
        await supabase.from("verifications").update({ status: "expired" }).eq("id", v.id);
        await fetch(`${supabaseUrl}/functions/v1/calculate-trust-score`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ passport_id: v.passport_id }),
        });
      }
    }

    if (notifications.length > 0) await supabase.from("notifications").insert(notifications);

    return json({ scanned: expiring?.length ?? 0, expired: expiredCount, expiring_soon: expiringCount });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
