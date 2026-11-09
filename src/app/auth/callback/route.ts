import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the redirect after Supabase email verification / magic link.
// Exchanges the code for a session, then routes by role. Requiring this
// route to exist and be correct is a known sharp edge (Ubulula shipped
// without it initially, breaking signUp() in production) — don't skip it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // SECURITY: `next` is attacker-controllable (it's a query param) and is
  // concatenated onto `origin`. Anything that isn't a plain absolute path
  // is rejected — this blocks both `//evil.com` protocol-relative jumps
  // and the `@evil.com` userinfo trick (`https://oursite.com@evil.com`
  // resolves to host evil.com), which a bare `origin + next` would
  // happily produce. Same validation exists on /login.
  const requestedNext = searchParams.get("next");
  const next =
    requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/entrepreneur/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
