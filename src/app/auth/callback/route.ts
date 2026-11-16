import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safeNext";

// Handles the redirect after Supabase email verification / magic link.
// Exchanges the code for a session, then routes by role. Requiring this
// route to exist and be correct is a known sharp edge (Ubulula shipped
// without it initially, breaking signUp() in production) — don't skip it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // SECURITY: `next` is attacker-controllable (it's a query param) and is
  // concatenated onto `origin`. safeNextPath() accepts it only if it
  // resolves to a same-origin path — see that helper for the bypasses a
  // plain prefix check misses. Same validation on /login.
  const next = safeNextPath(searchParams.get("next")) ?? "/entrepreneur/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
