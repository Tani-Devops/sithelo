# Zenzele — System Architecture

## High level

```
Next.js 15 (App Router)
  ├─ Server Components — read via session-bound Supabase client (RLS enforced)
  ├─ Client Components — auth forms, interactive widgets
  ├─ Route Handlers — privileged operations via service-role client, after
  │                     verifying caller role from the session client first
  └─ Middleware — session refresh + route protection (PUBLIC_PREFIXES allowlist)

Supabase
  ├─ Postgres — all tables, RLS on every table, no table is RLS-exempt
  ├─ Auth — email/password, magic link via /auth/callback
  ├─ Storage — 5 buckets (passport-documents, passport-images,
  │             institution-logos, generated-pdfs, bulk-imports)
  └─ Edge Functions (Deno) — see EDGE_FUNCTIONS.md for all 10

AI abstraction layer (src/lib/ai)
  └─ complete({system, prompt, ...}) — provider chosen by AI_PROVIDER env var,
      nothing else in the codebase imports a provider SDK directly
```

## Data flow: an opportunity being posted and matched

1. Institution submits a requirement → Route Handler calls `create-opportunity` edge function (server-role, since matching needs to read across all passports regardless of RLS).
2. `create-opportunity` inserts the row, then calls `match-businesses` internally (function-to-function HTTP call, service-role auth header).
3. `match-businesses` scores every published+verified passport against the requirement, writes to `matches`.
4. `create-opportunity` reads back strong matches (≥65 score) and inserts `notifications` rows for those entrepreneurs.
5. Entrepreneur sees the match on next dashboard load (Server Component re-fetches `matches` filtered by their `passport_id` — RLS-safe, no service role needed client-side).

## Why RLS is enforced everywhere, and where the service role is used instead

Every table has RLS policies (`002_rls_policies.sql`). The service role (which bypasses RLS) is used only:
- Inside edge functions, which run entirely server-side and are the only thing allowed to write `matches`, `audit_logs`, and recalculate `trust_score`
- Inside Next.js Route Handlers, and only after the request's session-bound client has confirmed the caller's role permits the action

The service role key (`SUPABASE_SERVICE_ROLE_KEY`) must never reach a Client Component or be embedded in any `NEXT_PUBLIC_*` variable.

## Auth flow

`signUp()` → Supabase sends confirmation email with `emailRedirectTo` pointed at `/auth/callback` → callback route exchanges the code for a session → redirects by role (entrepreneur/institution/admin dashboards). This mirrors the fix applied to Ubulula after a production auth bug caused by a missing callback route — it's included from day one here rather than discovered in production.

## Persona + Next Step engines (Aug 2026 pass)

`src/lib/persona/determinePersona.ts` and `src/lib/nextStep/determineNextStep.ts` are pure functions — no DB, no network, no AI. They take a plain object of already-fetched data and return a deterministic result; the same input always produces the same output, and every field in that output traces back to an input field (directive §7-9, §12: no fabricated explanations, no opaque scoring). `src/lib/persona/recompute.ts` is the one place that assembles their inputs from real Supabase rows and persists the result — called from two Route Handlers (`/api/persona/recompute`, `/api/onboarding/complete`) rather than duplicated between them.

This is also a second real example of the Route-Handler-with-service-role pattern described below (the first being `/api/documents/[id]/signed-url`): authenticate with the session-bound client first, then use the service client for the privileged write, because `entrepreneur_persona_state` has no `authenticated` INSERT/UPDATE grant at all (see DATA_CLASSIFICATION.md tier 0).

## Design system enforcement

`DESIGN_SYSTEM.md` is the single source of truth for colors/type/spacing/components, extracted from the reference screens. Tailwind config (`tailwind.config.ts`) encodes the color tokens directly (`forest`, `gold`, `cream`, `ink`, `line`) so new screens can't accidentally drift to ad-hoc hex values.
