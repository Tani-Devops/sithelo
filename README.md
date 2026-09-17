# Sithelo

**South Africa's Entrepreneur Network.** Institutions find, verify and contract with capacity-ready entrepreneurs through the Business Passport™.

## Status: substantially built, pre-launch

Read this before assuming anything below is further along than it is. **Read `AUDIT.md` first if you're evaluating security posture** — it documents real vulnerabilities that were found and fixed (role escalation via public registration, edge functions trusting client-supplied identity) and what's still explicitly open. This is no longer accurately described as a scaffold: every core entrepreneur, institution and admin flow below is wired to real Supabase data behind real RLS, across 27 migrations.

**Fully wired (real Supabase queries, real logic, no mock data):**
- Full DB schema + RLS on every table (`supabase/migrations/`)
- Auth: register, login, email verification callback, role-based redirect, middleware route protection
- Landing page, matching the reference design system exactly (`DESIGN_SYSTEM.md`)
- Entrepreneur / Institution / Admin dashboards — real Supabase reads, empty-state handling, no fake numbers
- Entrepreneur onboarding, Business Passport creation/edit, document upload, opportunity discovery and application/withdrawal
- Institution onboarding (`/institution/onboarding`, atomic via `complete_institution_onboarding()`, migration 027) and application management (`/institution/applications` — shortlist/reject/award, scoped entirely by RLS to the institution's own opportunities)
- Business Passport detail page — reads live data, tiered access (`owner_admin` / `authorized_institution` / `discovery`)
- Edge functions with real business logic: `calculate-trust-score`, `match-businesses`, `verify-business-passport`, `admin-verification`, `create-opportunity`, `compliance-monitor`, `audit-logger`, `notification-engine` (email via Resend; WhatsApp/SMS channels stubbed, see file header), `bulk-import`
- AI provider abstraction layer (`src/lib/ai`) supporting OpenRouter/OpenAI/Anthropic/Gemini
- Self-hosted Inter/Fraunces (via `@fontsource`) — no runtime Google Fonts request

**Structured but not built out — see `ROADMAP.md`:**
- `generate-business-passport-pdf` produces a minimal real PDF today; needs upgrade to the HTML-render pipeline documented in its file header for full visual fidelity (QR code, trust score ring, badges)
- Messaging UI, notification bell UI
- No test suite yet (Vitest/Playwright); pgTAP security tests exist under `supabase/tests/` but need a live Postgres/Supabase environment to run — see the implementation report for what's syntactically validated vs. actually executed
- CIPC/SARS/CIDB API integrations are not connected — verification is currently a human admin decision (`admin-verification`), not automated lookup
- Terms/Privacy pages are functionally complete but still need the registered company name, registration number, address, governing-law position and a monitored contact address (see `src/lib/legal/config.ts`) before public launch
- Marketing imagery is still loaded from `images.unsplash.com` rather than self-hosted (see `next.config.js` `remotePatterns`)

I did not fabricate demo content dressed up as real — the dashboards render empty states honestly when there's no data, rather than showing invented numbers.

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres, Auth, Storage, Edge Functions) · Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

See `SUPABASE_SETUP.md` for provisioning a Supabase project, running migrations, and deploying edge functions.

## Docs

- `PRODUCT_REQUIREMENTS.md` — what Sithelo is and who it's for
- `SYSTEM_ARCHITECTURE.md` — how the pieces fit together
- `DATABASE_SCHEMA.md` — table-by-table reference
- `SUPABASE_SETUP.md` — provisioning, migrations, edge function deploys
- `EDGE_FUNCTIONS.md` — what each function does and its current implementation status
- `DESIGN_SYSTEM.md` — colors, type, spacing, components, extracted from the reference screens
- `ROADMAP.md` — what's next, in priority order
