"use client";

import { useEffect } from "react";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { SitheloButton } from "@/components/ui/sithelo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console only — no raw error text is ever shown to the user.
    // Wire this up to real error monitoring (e.g. Sentry) before launch.
    console.error(error);
  }, [error]);

  return (
    <main>
      <SiteNav />
      <section className="max-w-[600px] mx-auto px-8 py-32 text-center">
        <div className="text-xs font-semibold tracking-wider uppercase text-teal mb-4">Something went wrong</div>
        <h1 className="text-3xl font-display font-bold tracking-tight text-navy mb-3">
          We hit a snag loading this page.
        </h1>
        <p className="text-ink-600 text-[15px] leading-relaxed mb-8">
          This has been logged on our side. Try again, or head back to the homepage.
        </p>
        <div className="flex gap-3 justify-center">
          <SitheloButton onClick={reset}>Try again</SitheloButton>
          <SitheloButton href="/" variant="ghost">Back to home</SitheloButton>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
