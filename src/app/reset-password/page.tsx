"use client";

// Second half of the password-reset flow. The user arrives here already
// signed in: /auth/callback exchanged the emailed code for a session
// before redirecting. The proxy sends anyone without a session to
// /login, so this page never needs to handle the signed-out case.
//
// After the password is changed the session is ended and the user logs
// in again with the new password — the reset link must not double as a
// way to stay signed in.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SitheloLogo, SitheloButton } from "@/components/ui/sithelo";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("We couldn't update your password. Request a new reset link and try again.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=done");
    router.refresh();
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-soft px-6">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex justify-center"><SitheloLogo height={48} /></div>
        <h1 className="text-2xl font-display font-medium text-navy mb-1.5">Choose a new password</h1>
        <p className="text-sm text-ink-600 mb-6">You&apos;ll use this password the next time you log in.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-navy mb-1.5">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} className="input" aria-describedby="password-hint" />
            <p id="password-hint" className="text-xs text-ink-500 mt-1.5">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-navy mb-1.5">Confirm new password</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <SitheloButton type="submit" disabled={loading} className="w-full py-3">
            {loading ? "Saving…" : "Save new password"}
          </SitheloButton>
        </form>
      </div>
    </main>
  );
}
