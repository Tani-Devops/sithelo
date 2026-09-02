// Server-side Supabase client for Server Components / Route Handlers.
// Uses the anon key + the caller's session cookie — still respects RLS.
// For privileged operations, use a service-role client inside a Route
// Handler only, never in a Server Component.
// See client.ts for why this isn't parameterized with our Database type.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component with no request context — safe to ignore
            // when middleware.ts is refreshing the session on every request.
          }
        },
      },
    }
  );
}
