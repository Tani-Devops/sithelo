/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Security headers on every route (audit finding: none existed before).
// CSP: App Router needs 'unsafe-inline' for its inline bootstrap script
// and styled-jsx, and dev needs 'unsafe-eval' for HMR + localhost
// websockets for Fast Refresh. Production drops both dev-only relaxations.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
      "font-src 'self'",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDev ? " ws://localhost:*" : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
module.exports = nextConfig;
