# MVP_STATUS.md — Sithelo (Aug 2026 build pass)

Format per directive §42: BUILT / NOT BUILT / TESTED / NOT EXECUTED / KNOWN LIMITATIONS / NEXT RECOMMENDED STEP.

## BUILT

- Entrepreneur reality/persona/needs/goals/capabilities/assets schema (migration 025)
- Deterministic Persona engine + Next Step engine (pure functions, no AI)
- Persona recompute path (`/api/persona/recompute`, `/api/onboarding/complete`)
- Onboarding wizard — 6 screens, informal-business-friendly, ranges not exact figures
- "We see you" magic moment screen
- `/entrepreneur/journey` persona explainer
- `/entrepreneur/opportunities/[id]` — real match reasons, apply/withdraw
- `/institution/opportunities/new` — 5-question creation flow
- `/institution/opportunities/[id]` — potential matches via `institution_business_directory`
- Dashboard persona/reality/next-step cards
- `/entrepreneur/business` (redirect) + `/entrepreneur/business/edit` (update form + capability/asset manager)
- pgTAP test file for the new schema (written, not executed — see below)
- Documentation updates: DATA_CLASSIFICATION, DATABASE_SCHEMA, ROADMAP, SYSTEM_ARCHITECTURE, PRODUCT_REQUIREMENTS, DESIGN_SYSTEM, SECURITY_AUDIT_MASTER

## NOT BUILT

- Messaging UI (explicitly optional for MVP per directive §32)
- Notification bell / `/notifications` page (table exists, nothing reads it — pre-existing gap)
- Institution applications review UI (`/institution/applications` — shortlist/reject/award actions)
- Entrepreneur applications list (`/entrepreneur/applications` — currently only reachable per-opportunity)
- Admin verification queue UI (pre-existing gap, function exists, no UI)
- Institution onboarding flow (`requireInstitution()` redirects to `/institution/onboarding`, which doesn't exist — pre-existing gap, not introduced this pass)
- A notification fired specifically for "your persona/next-step changed" (directive doesn't require this explicitly; flagged as a decision point in ROADMAP.md)

## TESTED (executed for real, in this build environment)

| Check | Result |
|---|---|
| `npm install` | Clean, 390 packages |
| `npx tsc --noEmit` | Zero errors |
| `npx next build` | Clean, all 22 routes compiled and generated |

Both typecheck and build were run twice across this session (after the first route batch, and again after the dashboard/edit-page changes) — both times clean.

## NOT EXECUTED

- `supabase test db` / `pg_prove` against migration 025 and the new `008_reality_persona_layer_security.test.sql` (16 assertions) — **REQUIRES LIVE/STAGING SUPABASE**, unavailable in this build environment (no Docker, no Postgres, no Supabase CLI)
- Migration 025 itself has never been applied to a real Postgres instance — its SQL syntax and RLS behavior are reasoned through against the codebase's established patterns, not confirmed by execution
- `deno lint` / `deno check` — not applicable this pass (no edge functions were added or changed)
- Any end-to-end/browser test of the onboarding → persona → opportunity → application flow

This is a materially different state from the prior security pass documented in SECURITY_AUDIT_MASTER.md, which achieved genuine `pg_prove`-verified execution (116/116) using a hand-built Postgres approximation. That approximation environment was not available to this session — this pass's database-layer claims are therefore "written and reasoned through," not "verified," and are represented as such throughout.

## KNOWN LIMITATIONS

- `get_passport_detail()` (migration 015) doesn't return `registration_number` even to the owner — a pre-existing gap, not introduced this pass. The new edit form can write it but can't prefill it.
- The Business Passport edit page and capabilities/assets manager are functionally complete but plainly styled (no `SitheloRing`/hero treatment) — see DESIGN_SYSTEM.md.
- No notification fires when a fresh Persona computation produces a meaningfully different Next Step — the entrepreneur only sees the update by revisiting the dashboard/journey page.
- The persona/next-step engines have no automated unit tests yet, despite being the easiest code in the repo to test (pure functions, no DB) — flagged in ROADMAP.md as the recommended first automated-test investment.

## NEXT RECOMMENDED STEP

Run migration 025 and the full pgTAP suite (`001`–`008`) against real staging Postgres via `supabase test db`. Every claim in this document above the "NOT EXECUTED" section holds regardless of that result (TypeScript/build layer is genuinely clean); everything in and below it should be treated as unverified until that run happens. After that: institution applications review UI, since it's the other half of the application loop the entrepreneur side (`/entrepreneur/opportunities/[id]`) already has working.
