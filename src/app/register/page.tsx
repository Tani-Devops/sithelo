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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    router.push("/register/check-email");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-soft px-6 py-12">
      <div className="card w-full max-w-md">
        <div className="mb-6"><SitheloLogo height={28} /></div>
        <h1 className="text-2xl font-display font-bold text-navy mb-1">Create your account</h1>
        <p className="text-sm text-ink-600 mb-6">
          Join Sithelo as {role === "institution" ? "an institution" : "an entrepreneur"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Full name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Email address</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Cell number</label>
            <input required value={cellNumber} onChange={(e) => setCellNumber(e.target.value)} placeholder="+27 82 000 0000" className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <SitheloButton type="submit" disabled={loading} className="w-full py-3">
            {loading ? "Creating account…" : "Next"}
          </SitheloButton>
        </form>

        <p className="text-sm text-ink-600 mt-6 text-center">
          Already have an account? <Link href="/login" className="text-cobalt font-medium">Login</Link>
        </p>
      </div>
    </main>
  );
}
