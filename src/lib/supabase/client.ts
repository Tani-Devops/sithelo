// Browser-side Supabase client (uses the anon key, respects RLS).
//
// Deliberately NOT parameterized with our Database type: @supabase/supabase-js
// 2.112's SupabaseClient generics require a `__InternalSupabase` version
// marker and a specific conditional-type shape that hand-authored types
// fight rather than satisfy cleanly (this is why Supabase recommends
// `supabase gen types typescript` over hand-rolled types — the generator
// emits the marker automatically). Query results are typed at the call
// site instead, casting to the interfaces in `@/types/database`. Once a
// live project exists, regenerate types and reinstate the generic here.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
