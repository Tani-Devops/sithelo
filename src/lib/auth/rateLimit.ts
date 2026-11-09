// Fail-closed rate limiting for route handlers.
//
// check_rate_limit() (migration 008) returns `true` when the caller is
// allowed and `false` when the window is exhausted. Anything else means
// the limiter itself failed — and rather than silently dropping the
// control (the old fail-open behavior), the request is rejected. A short
// outage of the rate-limiter is cheaper than an unbounded window for
// abuse; the edge functions (_shared/rateLimit.ts) already fail closed,
// so this brings the Next.js routes in line with them.
import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function enforceRateLimit(
  supabase: SupabaseClient,
  key: string,
  maxRequests: number,
  windowSeconds: number,
  limitedMessage: string
): Promise<NextResponse | null> {
  const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (allowed === false) {
    return NextResponse.json({ error: limitedMessage }, { status: 429 });
  }

  if (error || allowed !== true) {
    console.error(`Rate limit check failed for ${key}:`, error?.message ?? "non-boolean result");
    return NextResponse.json(
      { error: "We couldn't verify your request right now. Please try again shortly." },
      { status: 503 }
    );
  }

  return null;
}
