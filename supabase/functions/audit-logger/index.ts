// ====================================================================
// audit-logger
// Writes immutable audit records. Called internally by other edge
// functions (never exposed for direct client writes — audit_logs has
// no insert policy for authenticated users, only service role).
//
// Invoke: POST { actor_id, action, entity_type, entity_id, changes?, metadata? }
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { auditLogSchema, parseBody } from "../_shared/schemas.ts";
import { safeErrorMessage } from "../_shared/errors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// SECURITY: internal-only. Requires the caller to present the service-role
// key as bearer auth, so only other edge functions / trusted server-side
// Route Handlers can invoke this — never a browser client directly.

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "This function is internal-only" }, 403);
  }

  try {
    // Full schema validation before the DB write: action/entity_type must
    // be bounded lowercase dotted names, actor_id/entity_id must be real
    // UUIDs (or null), changes/metadata must be JSON objects. Previously
    // only truthiness was checked, so any service-role-key holder could
    // attribute arbitrary actions to arbitrary actors — forged audit
    // entries. Audit integrity is this function's entire purpose.
    const parsed = await parseBody(req, auditLogSchema);
    if (parsed instanceof Response) return parsed;
    const { actor_id, action, entity_type, entity_id, changes, metadata } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;

    const { error } = await supabase.from("audit_logs").insert({
      actor_id,
      action,
      entity_type,
      entity_id,
      changes,
      ip_address: ip,
      metadata: metadata ?? {},
    });
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: safeErrorMessage(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
