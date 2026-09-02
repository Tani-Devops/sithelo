# Zenzele — Product Requirements

## What this is not

Not LinkedIn, not a CRM/ERP, not a chatbot, not a generic business directory. Zenzele is infrastructure: a verified, portable credential (the Business Passport™) that entrepreneurs build once and use everywhere they seek opportunity.

## Users (exactly three roles)

1. **Entrepreneur** — owns a Business Passport, applies to opportunities, manages documents/verifications.
2. **Institution** — searches/filters verified businesses, posts opportunities, shortlists, contracts.
3. **Admin** (Zenzele team) — approves/rejects verifications, moderates content, oversees platform health.

## Core entity: the Business Passport

Everything in the product orbits this record. See `DATABASE_SCHEMA.md` for the `business_passports` table and its related tables (verifications, documents, references, activity, trust score history).

Fields that matter most to trust: `trust_score`, `overall_verification_status`, the eight verification types (CIPC, SARS, VAT, Bank, B-BBEE, Insurance, CIDB, Municipal Supplier). Trust Score is never hand-set — it's always derived by `calculate-trust-score` from actual verification/document/track-record state, so it can't drift from reality.

## The fundamental unit: PERSON + BUSINESS + REALITY + JOURNEY (Aug 2026 pass)

The Business Passport establishes business identity. Alongside it, `entrepreneur_profiles`/`entrepreneur_financial_snapshots`/`entrepreneur_needs`/`entrepreneur_goals` establish the entrepreneur's everyday reality, needs, and goals — collected once, in the "Tell Us About Yourself" onboarding wizard (`/entrepreneur/business/new`), using approximate ranges rather than exact figures and never gating on formal registration. From that data, a deterministic (non-AI) rules engine computes a **Sithelo Persona** — one of ten journey stages from Starter to Economic Builder — with an explanation, strengths, constraints, and a recommended next step, all traceable to real stored data. This is never a wealth ranking and never used to gate opportunity eligibility; household/reality data shapes recommendation framing only, and is never institution-visible (see DATA_CLASSIFICATION.md tier 0). See `/entrepreneur/journey` and the onboarding "We see you" screen.

## Primary flows

1. **Entrepreneur onboarding** → create passport + reality/needs/goals in one wizard → first Persona computed → upload documents → admin verifies → trust score rises → passport becomes eligible for matching (`is_published = true` requires baseline verification, not just profile completion).
2. **Institution requirement** → `create-opportunity` → `match-businesses` ranks eligible passports → strong matches notified → entrepreneur applies → institution shortlists/awards.
3. **Compliance** → `compliance-monitor` runs daily → flags expiring/expired verifications → notifies owner → trust score recalculated on expiry.

## South African context requirements

CIPC, SARS, VAT, B-BBEE, CIDB, and Municipal Supplier Database are first-class verification types, not generic "compliance docs." Province/municipality fields use the nine actual provinces (`sa_province` enum). None of CIPC/SARS/CIDB have live API integrations yet — see `ROADMAP.md`.

## Non-goals for v1

- Public business directory / SEO-driven discovery (Zenzele is permissioned: institutions search, they don't browse a public catalog)
- Payments/escrow between entrepreneur and institution (opportunities are matched and applied to; money changes hands off-platform for now)
- Multi-country support (South Africa only; the schema doesn't currently generalize province/municipality beyond SA)
