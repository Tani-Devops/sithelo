# Sithelo Documentation

All project documentation lives here, organised by topic. The root `README.md` covers the headline status; these files go deeper.

## Product

- [`PRODUCT_REQUIREMENTS.md`](product/PRODUCT_REQUIREMENTS.md) — what Sithelo is, who it's for, and the core product decisions
- [`ROADMAP.md`](product/ROADMAP.md) — what's next, in priority order
- [`MVP_STATUS.md`](product/MVP_STATUS.md) — what's verified vs. designed-only (including what has *not* been executed against a live instance)
- [`IMPLEMENTATION_SUMMARY.md`](product/IMPLEMENTATION_SUMMARY.md) — build-pass-by-build-pass record of what was delivered

## Architecture & infrastructure

- [`SYSTEM_ARCHITECTURE.md`](architecture/SYSTEM_ARCHITECTURE.md) — how the pieces fit together (four-layer security model, data flows, route map)
- [`DATABASE_SCHEMA.md`](architecture/DATABASE_SCHEMA.md) — table-by-table reference
- [`DATA_CLASSIFICATION.md`](architecture/DATA_CLASSIFICATION.md) — data sensitivity tiers and access rules
- [`EDGE_FUNCTIONS.md`](architecture/EDGE_FUNCTIONS.md) — what each Deno edge function does and its implementation status
- [`SUPABASE_SETUP.md`](architecture/SUPABASE_SETUP.md) — provisioning a Supabase project, running migrations, deploying edge functions

## Design

- [`DESIGN_SYSTEM.md`](design/DESIGN_SYSTEM.md) — colors, type, spacing, and components, extracted from the reference screens

## Security & compliance

Start with [`AUDIT.md`](security/AUDIT.md) for the current posture.

- [`AUDIT.md`](security/AUDIT.md) — current security posture: found-and-fixed vulnerabilities and what's explicitly still open
- [`SECURITY_AUDIT.md`](security/SECURITY_AUDIT.md) — early security audit
- [`SECURITY_AUDIT_MASTER.md`](security/SECURITY_AUDIT_MASTER.md) — the master running audit record, pass by pass
- [`SECURITY_AUDIT_MVP.md`](security/SECURITY_AUDIT_MVP.md) — condensed MVP security sign-off document
- [`RLS_MASTER_AUDIT.md`](security/RLS_MASTER_AUDIT.md) — table-by-table RLS/authorization audit
- [`SECURITY_ACCESS_MATRIX.md`](security/SECURITY_ACCESS_MATRIX.md) — role × resource access matrix
- [`SECURITY_TESTS.md`](security/SECURITY_TESTS.md) — the pgTAP security test suite (`supabase/tests/`) and how to run it
- [`COMPLIANCE_ACCESSIBILITY_AUDIT.md`](security/COMPLIANCE_ACCESSIBILITY_AUDIT.md) — compliance and accessibility audit

## Reports

- [`SITHELO_2_UI_IMPLEMENTATION_REPORT.md`](reports/SITHELO_2_UI_IMPLEMENTATION_REPORT.md) — UI rebuild report; before/after QA screenshots live in [`sithelo-2-qa/`](sithelo-2-qa/)

## Reference material

- [`reference/landing-static-reference.html`](reference/landing-static-reference.html) — the original static landing-page reference used to extract the design system
