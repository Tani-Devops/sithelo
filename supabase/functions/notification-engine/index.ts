// ====================================================================
// notification-engine
// Central dispatcher: writes the in-app notification row (always) and
// fans out to email via Resend when requested. WhatsApp/SMS channels
// are structured but not wired — see the TODOs below; the codebase's
// existing WhatsApp Cloud API + Resend patterns from other Zenzele
// Holdings projects should be reused here rather than reinvented.
//
// SECURITY: this function is INTERNAL-ONLY. It has no per-request user
// role to check (there's no meaningful "role that's allowed to notify
// anyone"), so instead of requireRole() it demands the caller present
// the service-role key itself as the bearer token — meaning only other
// edge functions and trusted server-side Route Handlers can invoke it,
// never a browser client. Deploy with `--no-verify-jwt` is NOT a
// substitute for this check; it must stay even if that flag is used.
//
// Invoke: POST { recipient_id, category, title, body, channels?: ('in_app'|'email')[], metadata? }
// Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { notificationRequestSchema, parseBody } from "../_shared/schemas.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY"); // optional — email skipped if unset

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "This function is internal-only" }, 403);
  }

  try {
    const parsed = await parseBody(req, notificationRequestSchema);
    if (parsed instanceof Response) return parsed;
    const { recipient_id, category, title, body, channels = ["in_app"], metadata } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const results: Record<string, string> = {};

    // In-app (always recorded, regardless of requested channels, so the
    // notification bell is a complete history)
    const { error: inAppErr } = await supabase
      .from("notifications")
      .insert({ recipient_id, channel: "in_app", category, title, body, metadata: metadata ?? {} });
    results.in_app = inAppErr ? `failed: ${inAppErr.message}` : "sent";

    // Email via Resend
    if (channels.includes("email")) {
      if (!resendApiKey) {
        results.email = "skipped: RESEND_API_KEY not configured";
      } else {
        const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", recipient_id).single();
        if (profile?.email) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Zenzele <notifications@zenzele.co.za>",
              to: profile.email,
              subject: title,
              html: `<p>Hi ${profile.full_name?.split(" ")[0] ?? "there"},</p><p>${body ?? ""}</p>`,
            }),
          });
          results.email = emailRes.ok ? "sent" : `failed: ${emailRes.status}`;
        } else {
          results.email = "skipped: no email on profile";
        }
      }
    }

    // TODO: WhatsApp Cloud API channel — reuse the HMAC-verified webhook
    // pattern and template-message sending already built for SpazaNet/Ubulula.
    if (channels.includes("whatsapp")) results.whatsapp = "not_implemented";
    // TODO: SMS channel — pick a provider (Clickatell / Twilio) and wire similarly.
    if (channels.includes("sms")) results.sms = "not_implemented";

    return json({ ok: true, results });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
