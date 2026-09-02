// ====================================================================
// _shared/auth.ts
// Every privileged edge function must call requireRole() before doing
// anything else. It NEVER trusts an id supplied in the request body —
// identity comes only from the caller's Supabase-issued JWT, verified
// against Supabase Auth, with role looked up from `profiles` using the
// service-role client (so RLS can't be used by the caller to lie about
// their own role either).
//
// Usage inside a function's Deno.serve handler:
//
//   const auth = await requireRole(req, ["admin"]);
//   if (!auth.ok) return auth.response;
//   // auth.user.id is now the ONLY trustworthy actor id — use it in
//   // place of any admin_id/user_id the request body might contain.
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type Role = "entrepreneur" | "institution" | "admin";

interface AuthSuccess {
  ok: true;
  user: { id: string; role: Role; institutionId: string | null };
}
interface AuthFailure {
  ok: false;
  response: Response;
}

export async function requireRole(req: Request, allowedRoles: Role[]): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: unauthorized("Missing Authorization header") };
  }
  const jwt = authHeader.slice("Bearer ".length);

  // Service-role client used only to verify the token and look up role —
  // never to skip the check itself.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return { ok: false, response: unauthorized("Invalid or expired token") };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, institution_id")
    .eq("id", userData.user.id)
    .single();
  if (profileErr || !profile) {
    return { ok: false, response: unauthorized("No profile found for authenticated user") };
  }

  if (!allowedRoles.includes(profile.role as Role)) {
    return { ok: false, response: forbidden(`Requires role: ${allowedRoles.join(" or ")}`) };
  }

  return {
    ok: true,
    user: { id: userData.user.id, role: profile.role as Role, institutionId: profile.institution_id },
  };
}

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 401, headers: { "Content-Type": "application/json" } });
}
function forbidden(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 403, headers: { "Content-Type": "application/json" } });
}
