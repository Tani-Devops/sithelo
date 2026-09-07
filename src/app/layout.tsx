import type { Metadata } from "next";
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

// Fonts loaded via <link> rather than next/font/google: next/font fetches
// and self-hosts font files at BUILD TIME, which requires network access
// to fonts.googleapis.com — unavailable in this environment's build
// sandbox (confirmed by an actual failed build attempt, not assumed).
// A real deployment target (Vercel, any CI with normal internet access)
// would have no trouble with next/font either way; this is the safer,
// environment-independent choice regardless, since it doesn't couple the
// build itself to a third-party network call succeeding.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet" />
      </head>
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
