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
import { safeErrorMessage } from "../_shared/errors.ts";

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
    // Status-only result: raw DB error text (constraint names, relation
    // details) must not be echoed to callers; log it server-side instead.
    if (inAppErr) console.error("notification-engine: in-app insert failed:", inAppErr.message);
    results.in_app = inAppErr ? "failed: could not write in-app notification" : "sent";

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
              // Was hardcoded to a different Zenzele Holdings project's
              // domain (zenzele.co.za) — copy/paste leftover. Sithelo's own
              // domain is used everywhere else in this codebase (see
              // NEXT_PUBLIC_SITE_URL default in .env.example / layout.tsx).
              // Before launch: confirm notifications@sithelo.co.za is
              // verified as a sending domain in the Resend dashboard, or
              // emails will silently fail to deliver.
              from: "Sithelo <notifications@sithelo.co.za>",
              to: profile.email,
              subject: title,
              // Both interpolated values are HTML-escaped: full_name comes
              // from the recipient's own profile and body from the caller,
              // and an unescaped user-controlled string here is stored HTML
              // injection into every email this function sends.
              html: `<p>Hi ${escapeHtml(profile.full_name?.split(" ")[0] ?? "there")},</p><p>${escapeHtml(body ?? "")}</p>`,
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
    return json({ error: safeErrorMessage(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * HTML-escapes text before it is interpolated into email HTML. Must be
 * applied to any string that could ever carry user-authored content —
 * otherwise a malicious business name / notification body becomes stored
 * HTML injection in every email built from it.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
