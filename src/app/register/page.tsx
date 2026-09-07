"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SitheloLogo, SitheloButton } from "@/components/ui/sithelo";
import type { UserRole } from "@/types/database";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const initialRole = (params.get("role") as UserRole) ?? "entrepreneur";

  const [role] = useState<UserRole>(initialRole === "institution" ? "institution" : "entrepreneur");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cellNumber, setCellNumber] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("Please confirm you agree to the Privacy Policy before creating an account.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName, role, cell_number: cellNumber },
      },
    });
    if (signUpError) {
      setError("We couldn't create your account. Please check your details and try again.");
      setLoading(false);
      return;
    }

    // Profile creation happens server-side via the handle_new_user trigger
    // — the client never writes the profiles table directly, so role
    // can never be forged from here.
    if (!data.user) {
      setError("Something went wrong creating your account. Please try again.");
      setLoading(false);
      return;
    }

    // Sithelo currently has "Confirm email" disabled in Supabase Auth
    // settings for this flow, so signUp() already returns a live
    // session and we can go straight into the product. If that project
    // setting is ever turned back on, data.session will come back null
    // here and this sign-in call will surface a clear error instead of
    // silently landing on a page the (unconfirmed) session can't load.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Your account was created, but we couldn't sign you in automatically. Please log in.");
        setLoading(false);
        router.push("/login");
        return;
      }
    }

    router.push(role === "institution" ? "/institution/dashboard" : "/entrepreneur/dashboard");
    router.refresh();
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-soft px-6 py-12">
      <div className="card w-full max-w-md">
        <div className="mb-6"><SitheloLogo height={34} /></div>
        <h1 className="text-2xl font-display font-medium text-navy mb-1.5">Create your account</h1>
        <p className="text-sm text-ink-600 mb-6">
          Join Sithelo as {role === "institution" ? "an institution" : "an entrepreneur"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-navy mb-1.5">Full name</label>
            <input id="fullName" name="fullName" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" className="input" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-navy mb-1.5">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
          </div>
          <div>
            <label htmlFor="cellNumber" className="block text-sm font-medium text-navy mb-1.5">Cell number</label>
            <input id="cellNumber" name="cellNumber" type="tel" autoComplete="tel" required value={cellNumber} onChange={(e) => setCellNumber(e.target.value)} placeholder="+27 82 000 0000" className="input" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-navy mb-1.5">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" className="input" aria-describedby="password-hint" />
            <p id="password-hint" className="text-xs text-ink-500 mt-1.5">At least 8 characters.</p>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-line text-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            <label htmlFor="consent" className="text-sm text-ink-600 leading-snug">
              I agree to Sithelo&apos;s <Link href="/terms" className="text-cobalt font-medium">Terms of Service</Link> and{" "}
              <Link href="/privacy" className="text-cobalt font-medium">Privacy Policy</Link>, and understand how my information will be used.
            </label>
          </div>

          {error && (
            <p role="alert" aria-live="polite" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <SitheloButton type="submit" disabled={loading} className="w-full py-3">
            {loading ? "Creating account…" : "Create account"}
          </SitheloButton>
        </form>

        <p className="text-sm text-ink-600 mt-6 text-center">
          Already have an account? <Link href="/login" className="text-cobalt font-medium">Login</Link>
        </p>
      </div>
    </main>
  );
}
