# Edge Functions Reference

All functions live in `supabase/functions/<name>/index.ts`, Deno runtime, service-role Supabase client. Every function now enforces its own authorization — see `AUDIT.md` for why this changed and `_shared/auth.ts` for the shared `requireRole()` helper.

## Authorization model

Two patterns, applied per function:

- **User-facing, role-checked** (`admin-verification`, `bulk-import`, `create-opportunity`, `verify-business-passport`, `generate-business-passport-pdf`): caller sends `Authorization: Bearer <their Supabase access token>`. The function calls `requireRole(req, [...])`, which verifies the JWT and looks up the caller's role server-side — never trusts an id in the request body.
- **Internal-only** (`calculate-trust-score`, `match-businesses`, `audit-logger`, `compliance-monitor`, `notification-engine`): no end-user role is meaningful for these — they're system-to-system. Caller must present the service-role key itself as bearer auth. Only other edge functions and trusted server-side Route Handlers can call them.

| Function | Auth model | What it actually does |
|---|---|---|
| `calculate-trust-score` | Internal-only | Weighted score from verification status/decay, track record, profile completeness. Writes score + history row. |
| `match-businesses` | Internal-only | Scores published+verified passports against an opportunity's requirements. Writes `matches`. |
| `verify-business-passport` | Owner / institution-on-published / admin | Reads verification state, returns readiness report + recommended next step. |
| `admin-verification` | Admin only | Approves/rejects a verification → recalculates trust score → audit log → notifies owner. Actor is the verified caller, never a body param. |
| `create-opportunity` | Institution (own) / admin | Inserts opportunity scoped to the caller's own institution → triggers matching → notifies matches. |
| `audit-logger` | Internal-only | Writes immutable audit rows. |
| `compliance-monitor` | Internal-only, scheduled | Scans expiring/expired verifications, notifies owners, downgrades status. |
| `notification-engine` | Internal-only | In-app + email (Resend) wired. WhatsApp/SMS return `not_implemented`. |
| `generate-business-passport-pdf` | Owner / admin | Real PDF via `pdf-lib`; visual fidelity upgrade path documented in file header. |
| `bulk-import` | Admin only | Parses CSV, invites users (profile created by the `handle_new_user` trigger, not this function), creates passports, queues for review. Upload CSVs to `imports/<admin-user-id>/<filename>.csv` in the `bulk-imports` bucket — `csv_storage_path` is validated to require that exact namespace, reject `..`, leading `/`, and `//` (path-traversal hardening added after a real gap was found: the prior regex allowed all of those). |

## Invocation pattern

Functions call each other via HTTP with the service-role key as bearer auth (e.g. `create-opportunity` → `match-businesses`, `admin-verification` → `calculate-trust-score`). From the Next.js app, user-facing functions should be called from Route Handlers that forward the user's session token — never from Client Components directly with a hardcoded key.

## Local testing

```bash
supabase functions serve admin-verification --env-file .env.local
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/admin-verification' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <a real admin user access token>' \
  --data '{"verification_id":"<uuid>","decision":"approve"}'
```

