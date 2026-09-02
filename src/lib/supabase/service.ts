// Service-role Supabase client. Bypasses RLS entirely.
// NEVER import this into a Client Component or expose SUPABASE_SERVICE_ROLE_KEY
// to the browser. Use only inside Route Handlers / Server Actions after the
// caller's role has already been checked via the session-bound server client.
// See client.ts for why this isn't parameterized with our Database type.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
