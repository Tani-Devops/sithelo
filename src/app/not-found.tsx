import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { SitheloButton } from "@/components/ui/sithelo";

export const metadata: Metadata = {
  title: "Page not found | Sithelo",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main id="main-content">
      <SiteNav />
      <section className="max-w-[600px] mx-auto px-8 py-32 text-center">
        <div className="text-xs font-semibold tracking-wider uppercase text-teal mb-4">404</div>
        <h1 className="text-3xl font-display font-medium tracking-tight text-navy mb-3">
          We couldn&apos;t find that page.
        </h1>
        <p className="text-ink-600 text-[15px] leading-relaxed mb-8">
          The page you&apos;re looking for may have moved or no longer exists.
        </p>
        <div className="flex gap-3 justify-center">
          <SitheloButton href="/">Back to home</SitheloButton>
          <SitheloButton href="/resources" variant="ghost">Browse Resources</SitheloButton>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
