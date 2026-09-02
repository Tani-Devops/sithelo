import { SitheloLogo } from "@/components/ui/sithelo";

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-soft px-6">
      <div className="card w-full max-w-md text-center">
        <div className="mb-6 flex justify-center"><SitheloLogo height={28} /></div>
        <h1 className="text-2xl font-display font-bold text-navy mb-2">Check your inbox</h1>
        <p className="text-sm text-ink-600">
          We&apos;ve sent a confirmation link to your email address. Click it to activate your Sithelo account.
        </p>
      </div>
    </main>
  );
}
