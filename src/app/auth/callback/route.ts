import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the redirect after Supabase email verification / magic link.
// Exchanges the code for a session, then routes by role. Requiring this
// route to exist and be correct is a known sharp edge (Ubulula shipped
// without it initially, breaking signUp() in production) — don't skip it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/entrepreneur/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
