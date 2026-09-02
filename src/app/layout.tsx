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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-soft text-ink-900">{children}</body>
    </html>
  );
}
