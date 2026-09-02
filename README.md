# Zenzele

**South Africa's Entrepreneur Network.** Institutions find, verify and contract with capacity-ready entrepreneurs through the Business Passport™.

## Status: functional scaffold, not a finished production platform

Read this before assuming anything below is further along than it is. **Read `AUDIT.md` first if you're evaluating security posture** — it documents real vulnerabilities that were found and fixed (role escalation via public registration, edge functions trusting client-supplied identity) and what's still explicitly open.

**Fully wired (real Supabase queries, real logic, no mock data):**
- Full DB schema + RLS on every table (`supabase/migrations/`)
- Auth: register, login, email verification callback, role-based redirect, middleware route protection
- Landing page, matching the reference design system exactly (`DESIGN_SYSTEM.md`)
- Entrepreneur / Institution / Admin dashboards — real Supabase reads, empty-state handling, no fake numbers
- Business Passport detail page — reads live data
- Edge functions with real business logic: `calculate-trust-score`, `match-businesses`, `verify-business-passport`, `admin-verification`, `create-opportunity`, `compliance-monitor`, `audit-logger`, `notification-engine` (email via Resend; WhatsApp/SMS channels stubbed, see file header), `bulk-import`
- AI provider abstraction layer (`src/lib/ai`) supporting OpenRouter/OpenAI/Anthropic/Gemini

**Structured but not built out — see `ROADMAP.md`:**
- `generate-business-passport-pdf` produces a minimal real PDF today; needs upgrade to the HTML-render pipeline documented in its file header for full visual fidelity (QR code, trust score ring, badges)
- Search/filter UI for institutions, opportunity creation forms, application flow UI, messaging UI, notification bell UI, institution onboarding flow, admin verification queue UI — routes are referenced in nav but pages don't exist yet
- Sub-pages under `/entrepreneur/*`, `/institution/*`, `/admin/*` beyond `/dashboard`
- No test suite yet (Vitest/Playwright, per the pattern used on SpazaNet)
- CIPC/SARS/CIDB API integrations are not connected — verification is currently a human admin decision (`admin-verification`), not automated lookup

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

- `PRODUCT_REQUIREMENTS.md` — what Zenzele is and who it's for
- `SYSTEM_ARCHITECTURE.md` — how the pieces fit together
- `DATABASE_SCHEMA.md` — table-by-table reference
- `SUPABASE_SETUP.md` — provisioning, migrations, edge function deploys
- `EDGE_FUNCTIONS.md` — what each function does and its current implementation status
- `DESIGN_SYSTEM.md` — colors, type, spacing, components, extracted from the reference screens
- `ROADMAP.md` — what's next, in priority order
