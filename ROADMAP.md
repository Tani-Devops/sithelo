# Roadmap

Priority order for continuing development, sequenced so each step is independently testable.

## Built this pass (Aug 2026 — Sithelo MVP directive)

Onboarding wizard (`/entrepreneur/business/new`) → Business Passport creation → reality/needs/goals capture → first Persona computed in the same request → "We see you" magic moment (`/entrepreneur/onboarding/complete`) → dashboard now shows Persona + reality + next-step cards → `/entrepreneur/journey` (full persona explainer) → opportunity detail with real match reasons + apply/withdraw → institution opportunity creation (`/institution/opportunities/new`) → institution "potential matches" view. Passport edit form + capabilities/assets manager (`/entrepreneur/business/edit`). See IMPLEMENTATION_SUMMARY.md and MVP_STATUS.md for the full breakdown, including what's NOT executed (nothing has run against real Postgres — no Supabase/Docker available in the build environment).

## Next (highest leverage first)

1. **Run migration 025 + the full pgTAP suite (incl. the new 008 file) against real staging Postgres.** Nothing below this should be trusted as "working," only "typechecks and builds," until this happens.
2. **Admin: verification queue UI** — list `verifications` where `status = 'pending'`, approve/reject buttons calling `admin-verification`. Currently that function only has a curl-testable API.
3. **Institution: applications review UI** (`/institution/applications`) — shortlist/reject/award actions against the existing `applications` RLS.
4. **Entrepreneur: applications list** (`/entrepreneur/applications`) — currently only reachable per-opportunity via the detail page.
5. **notification-engine coverage for the persona/reality layer** — the directive's minimal notification set (verification approved/rejected, new strong match, application status changed, shortlisted, awarded) exists in `notifications.category`, but nothing currently fires a notification when a fresh Persona computes a materially different Next Step. Worth deciding deliberately rather than adding silently.

## Then

6. Messaging UI (schema exists, no interface)
7. Notification bell + `/notifications` page (in-app notifications are being written already — nothing reads them in the UI yet)
8. Institution onboarding flow (demo request → approval → org creation, referenced in `requireInstitution()` guard redirect but not built)
9. `generate-business-passport-pdf` upgrade to HTML-render pipeline for full visual fidelity
10. WhatsApp Cloud API wiring for `notification-engine`

## Requires an explicit decision before building

- **CIPC/SARS/CIDB live verification.** Right now verification is a human admin decision. Automating it needs API access agreements with those institutions — a legal/business step, not just engineering.
- **PDF rendering approach** — pdf-lib (fast, lower fidelity) vs. headless-browser HTML render (slower, matches design system exactly). See `generate-business-passport-pdf/index.ts` header.
- **SMS provider** for `notification-engine` (Clickatell vs. Twilio vs. other).
- **Tier-2 institution unlock condition** — resolved for `business_passports` contact/financial fields (see DATA_CLASSIFICATION.md), but the equivalent question hasn't been asked yet for whether an authorized institution (post-shortlist/application) should ever see anything from the tier-0 reality layer. Current answer is a hard no, and directive §9 explicitly forbids it — flagging only so nobody "fixes" this later without re-reading why.

## Testing debt

pgTAP coverage exists for the core schema (`supabase/tests/database/001`–`007`) and now the reality/persona layer (`008`), but **none of it has been executed** in this build environment (no Postgres/Docker/Supabase CLI available). Run `supabase test db` on staging before trusting any of it. No Vitest/Playwright coverage yet for the persona/next-step pure functions (`src/lib/persona`, `src/lib/nextStep`) despite being the easiest code in the repo to unit test — recommended as the first automated-test investment, since they need no database at all.
