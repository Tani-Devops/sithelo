// ====================================================================
// audit-logger
// Writes immutable audit records. Called internally by other edge
// functions (never exposed for direct client writes — audit_logs has
// no insert policy for authenticated users, only service role).
//
// Invoke: POST { actor_id, action, entity_type, entity_id, changes?, metadata? }
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
    const body = await req.json();
    const { actor_id, action, entity_type, entity_id, changes, metadata } = body;

    if (!action || !entity_type) {
      return json({ error: "action and entity_type are required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;

    const { error } = await supabase.from("audit_logs").insert({
      actor_id: actor_id ?? null,
      action,
      entity_type,
      entity_id: entity_id ?? null,
      changes: changes ?? null,
      ip_address: ip,
      metadata: metadata ?? {},
    });
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
