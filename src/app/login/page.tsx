"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SitheloLogo, SitheloButton } from "@/components/ui/sithelo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("We couldn't sign you in. Check your email and password and try again.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const next = params.get("next");
    const destination =
      next ?? (profile?.role === "institution" ? "/institution/dashboard"
        : profile?.role === "admin" ? "/admin/dashboard"
        : "/entrepreneur/dashboard");
    router.push(destination);
    router.refresh();
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-soft px-6">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex justify-center"><SitheloLogo height={48} /></div>
        <h1 className="text-2xl font-display font-medium text-navy mb-1.5">Welcome back</h1>
        <p className="text-sm text-ink-600 mb-6">Login to your Sithelo account</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-navy mb-1.5">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-navy mb-1.5">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="input" />
          </div>
          {error && (
            <p role="alert" aria-live="polite" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <SitheloButton type="submit" disabled={loading} className="w-full py-3">
            {loading ? "Signing in…" : "Login"}
          </SitheloButton>
        </form>

        <p className="text-sm text-ink-600 mt-6 text-center">
          Don&apos;t have an account? <Link href="/register" className="text-cobalt font-medium">Register</Link>
        </p>
      </div>
    </main>
  );
}
