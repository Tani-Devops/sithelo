"use client";

// Requests a password-reset email. The link in that email lands on
// /auth/callback, which exchanges the code for a session and forwards
// to /reset-password, where the new password is set.
//
// The confirmation shown is identical whether or not the address has an
// account, so this form cannot be used to discover who is registered.
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SitheloLogo, SitheloButton } from "@/components/ui/sithelo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter the email address you registered with.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);

    // Rate limiting is the one failure worth surfacing; anything else is
    // reported as sent so the response never reveals whether the account exists.
    if (resetError?.status === 429) {
      setError("Too many requests. Please wait a few minutes and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-soft px-6">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex justify-center"><SitheloLogo height={48} /></div>

        {sent ? (
          <div role="status">
            <h1 className="text-2xl font-display font-medium text-navy mb-1.5">Check your inbox</h1>
            <p className="text-sm text-ink-600">
              If an account exists for {email.trim()}, we&apos;ve sent a link to reset your password. The link expires after one hour.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-display font-medium text-navy mb-1.5">Reset your password</h1>
            <p className="text-sm text-ink-600 mb-6">Enter your email address and we&apos;ll send you a link to choose a new password.</p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-navy mb-1.5">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <SitheloButton type="submit" disabled={loading} className="w-full py-3">
                {loading ? "Sending…" : "Send reset link"}
              </SitheloButton>
            </form>
          </>
        )}

        <p className="text-sm text-ink-600 mt-6 text-center">
          <Link href="/login" className="text-cobalt font-medium">Back to login</Link>
        </p>
      </div>
    </main>
  );
}
