import Link from "next/link";
import { SitheloLogo } from "@/components/ui/sithelo";

export default function CheckEmailPage() {
  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-soft px-6">
      <div className="card w-full max-w-md text-center">
        <div className="mb-6 flex justify-center"><SitheloLogo height={48} /></div>
        <h1 className="text-2xl font-display font-medium text-navy mb-2">Check your inbox</h1>
        <p className="text-sm text-ink-600">
          We&apos;ve sent a confirmation link to your email address. Click it to activate your Sithelo account.
        </p>
        <p className="text-sm text-ink-600 mt-6">
          Already confirmed? <Link href="/login" className="text-cobalt font-medium">Log in</Link>
        </p>
      </div>
    </main>
  );
}
