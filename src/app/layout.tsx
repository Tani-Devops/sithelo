import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource-variable/fraunces/standard.css";
import "@fontsource-variable/fraunces/standard-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://sithelo.co.za"),
  title: "Sithelo | Helping entrepreneurs turn effort into results",
  description:
    "Sithelo connects South African entrepreneurs with institutions, procurement, funding and enterprise development opportunities through a verified Business Passport.",
  openGraph: {
    title: "Sithelo",
    description: "Helping entrepreneurs turn effort into results.",
    siteName: "Sithelo",
    type: "website",
  },
  // Favicon, Apple touch icon and the Open Graph image are served
  // automatically by Next.js from src/app/icon.png, apple-icon.png and
  // opengraph-image.png — no manual `icons`/`images` override needed here.
};

// Fonts (Inter, Fraunces) are self-hosted via @fontsource/inter and
// @fontsource-variable/fraunces (imported above), not loaded at runtime
// from fonts.googleapis.com/fonts.gstatic.com. This removes an external
// dependency and its associated per-visitor request to Google, and
// means the site keeps working (typography included) if Google Fonts is
// ever slow or unreachable. A previous pass used a runtime <link> here
// because this sandbox's build environment couldn't reach
// fonts.googleapis.com — @fontsource ships the actual font files
// through the npm registry instead, which this environment can reach,
// so that workaround is no longer needed.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-ivory text-ink-900">
        {/* Skip link: invisible until keyboard-focused, lets keyboard/screen-reader
            users jump straight past repeated nav/sidebar markup on every page. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-sm focus:bg-navy focus:text-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
