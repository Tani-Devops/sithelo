# Sithelo

**South Africa's Entrepreneur Network.** Institutions find, verify and contract with capacity-ready entrepreneurs through the Business Passport™.

## Status: substantially built, pre-launch

Read this before assuming anything below is further along than it is. **Read `docs/security/AUDIT.md` first if you're evaluating security posture** — it documents real vulnerabilities that were found and fixed (role escalation via public registration, edge functions trusting client-supplied identity) and what's still explicitly open. This is no longer accurately described as a scaffold: every core entrepreneur, institution and admin flow below is wired to real Supabase data behind real RLS, across 33 migrations.

**Fully wired (real Supabase queries, real logic, no mock data):**
- Full DB schema + RLS on every table (`supabase/migrations/`)
- Auth: register, login, email verification callback, role-based redirect, proxy route protection
- Landing page, matching the reference design system exactly (`docs/design/DESIGN_SYSTEM.md`)
- Entrepreneur / Institution / Admin dashboards — real Supabase reads, empty-state handling, no fake numbers
- Entrepreneur onboarding, Business Passport creation/edit, document upload, opportunity discovery and application/withdrawal
- Institution onboarding (`/institution/onboarding`, atomic via `complete_institution_onboarding()`, migration 027) and application management (`/institution/applications` — shortlist/reject/award, scoped entirely by RLS to the institution's own opportunities)
- Business Passport detail page — reads live data, tiered access (`owner_admin` / `authorized_institution` / `discovery`)
- Edge functions with real business logic: `calculate-trust-score`, `match-businesses`, `verify-business-passport`, `admin-verification`, `create-opportunity`, `compliance-monitor`, `audit-logger`, `notification-engine` (email via Resend; WhatsApp/SMS channels stubbed, see file header), `bulk-import`
- AI provider abstraction layer (`src/lib/ai`) supporting OpenRouter/OpenAI/Anthropic/Gemini
- Self-hosted Inter/Fraunces (via `@fontsource`) — no runtime Google Fonts request

**Structured but not built out — see `docs/product/ROADMAP.md`:**
- `generate-business-passport-pdf` produces a minimal real PDF today; needs upgrade to the HTML-render pipeline documented in its file header for full visual fidelity (QR code, trust score ring, badges)
- Messaging UI, notification bell UI
- No test suite yet (Vitest/Playwright); pgTAP security tests exist under `supabase/tests/` but need a live Postgres/Supabase environment to run — see the [implementation report](docs/reports/SITHELO_2_UI_IMPLEMENTATION_REPORT.md) for what's syntactically validated vs. actually executed
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

See `docs/architecture/SUPABASE_SETUP.md` for provisioning a Supabase project, running migrations, and deploying edge functions.

## Docs

All documentation lives under [`docs/`](docs/README.md) — see its index for the full map.

- **Product** ([`docs/product/`](docs/product/))
  - [`PRODUCT_REQUIREMENTS.md`](docs/product/PRODUCT_REQUIREMENTS.md) — what Sithelo is and who it's for
  - [`ROADMAP.md`](docs/product/ROADMAP.md) — what's next, in priority order
  - [`MVP_STATUS.md`](docs/product/MVP_STATUS.md) — what's verified vs. designed-only
  - [`IMPLEMENTATION_SUMMARY.md`](docs/product/IMPLEMENTATION_SUMMARY.md) — what each build pass delivered
- **Architecture & infrastructure** ([`docs/architecture/`](docs/architecture/))
  - [`SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md) — how the pieces fit together
  - [`DATABASE_SCHEMA.md`](docs/architecture/DATABASE_SCHEMA.md) — table-by-table reference
  - [`DATA_CLASSIFICATION.md`](docs/architecture/DATA_CLASSIFICATION.md) — data sensitivity tiers and access rules
  - [`EDGE_FUNCTIONS.md`](docs/architecture/EDGE_FUNCTIONS.md) — what each function does and its implementation status
  - [`SUPABASE_SETUP.md`](docs/architecture/SUPABASE_SETUP.md) — provisioning, migrations, edge function deploys
- **Design** ([`docs/design/`](docs/design/))
  - [`DESIGN_SYSTEM.md`](docs/design/DESIGN_SYSTEM.md) — colors, type, spacing, components, extracted from the reference screens
- **Security & compliance** ([`docs/security/`](docs/security/))
  - [`AUDIT.md`](docs/security/AUDIT.md) — current security posture; read this first
  - [`SECURITY_AUDIT.md`](docs/security/SECURITY_AUDIT.md) · [`SECURITY_AUDIT_MASTER.md`](docs/security/SECURITY_AUDIT_MASTER.md) · [`SECURITY_AUDIT_MVP.md`](docs/security/SECURITY_AUDIT_MVP.md) — audit passes
  - [`RLS_MASTER_AUDIT.md`](docs/security/RLS_MASTER_AUDIT.md) · [`SECURITY_ACCESS_MATRIX.md`](docs/security/SECURITY_ACCESS_MATRIX.md) — RLS/authorization coverage
  - [`SECURITY_TESTS.md`](docs/security/SECURITY_TESTS.md) — pgTAP suite status
  - [`COMPLIANCE_ACCESSIBILITY_AUDIT.md`](docs/security/COMPLIANCE_ACCESSIBILITY_AUDIT.md) — compliance & accessibility
- **Reports** ([`docs/reports/`](docs/reports/))
  - [`SITHELO_2_UI_IMPLEMENTATION_REPORT.md`](docs/reports/SITHELO_2_UI_IMPLEMENTATION_REPORT.md) — UI rebuild report with QA screenshots
