// ====================================================================
// _shared/rateLimit.ts
// Thin wrapper around the check_rate_limit() Postgres function
// (migration 008). Call before doing the expensive/abusable work.
//
// Fail-open vs fail-closed (Phase 8 adversarial review): the original
// version failed open unconditionally — any transient DB error during
// the rate-limit check itself would silently allow the request through.
// That's the right default for low-risk, availability-sensitive
// operations, but wrong for operations with real mass side effects.
// Callers now choose explicitly via `failClosed`:
//   - bulk-import: failClosed = true — a broken rate limiter must not
//     become "unlimited real user account creation," which is what
//     fail-open would mean here.
//   - create-opportunity: failClosed = true — same reasoning, spam
//     vector with real downstream effects (notifications sent to
//     entrepreneurs, matching computed).
//   - generate-business-passport-pdf, documents signed-url: failClosed =
//     false (default) — availability matters more here, and the actual
//     security boundary (authorization) is enforced independently and
//     unaffected by the rate limiter's own health.
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
  failClosed = false
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`Rate limit check failed for key "${key}" (failClosed=${failClosed}):`, error);
    return !failClosed;
  }
  return data === true;
}

export function rateLimitResponse() {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
