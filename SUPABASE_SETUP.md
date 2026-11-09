# Supabase Setup

## 1. Create the project

Create a project at supabase.com, region `af-south-1` (Cape Town) to keep latency and data residency in South Africa, matching the pattern used across other Zenzele Holdings projects.

## 2. Run migrations

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

This applies, in order: `001_core_schema.sql` → `002_rls_policies.sql` → `003_storage_buckets.sql` → `004_fix_role_escalation.sql`. The fourth migration is a security fix (see `AUDIT.md`) — profile creation now happens via a database trigger on signup, not a client-side insert, and clamps role to `entrepreneur`/`institution` only.

## Provisioning the first admin account

There's no self-service or automated path to create an admin — deliberately, since that's exactly the privilege-escalation surface `004_fix_role_escalation.sql` closes off. To create the first (bootstrap) admin, run `supabase/scripts/bootstrap_admin.sql` (SQL editor or `psql`) after the person has already registered normally as an entrepreneur. The script:

- Looks the profile up by the email you edit into the placeholder
- Promotes it and writes an `audit_logs` entry (`admin.bootstrap_promoted`) so even the out-of-band promotion is on the record
- Is idempotent (a re-run on an already-admin profile is a no-op) and raises if the email isn't registered

This bypasses RLS by running with your own database-owner credentials, which is intentional — it's an out-of-band action that should require project-level access, not something reachable through the app. There's no bootstrap secret or token stored anywhere for this — direct database access *is* the bootstrap mechanism, and it naturally expires the moment you're done using it (nothing persists that could later leak).

**Every admin after the first** must be provisioned by an existing admin, through the app, using the RPC functions from `009_admin_provisioning.sql`:

```ts
// from an admin-authenticated Supabase client
await supabase.rpc("admin_promote_user", { target_user_id: "<uuid of an existing entrepreneur/institution user>" });

// demotion requires specifying the role to fall back to, and refuses
// to demote the last remaining admin
await supabase.rpc("admin_demote_user", { target_user_id: "<uuid>", new_role: "entrepreneur" });
```

Both are audited automatically (`audit_logs`, action `admin.promoted` / `admin.demoted`). There's no UI for this yet — see `ROADMAP.md` for the admin user-management screen that should wrap these calls.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — same page, **server-only**, never prefix with `NEXT_PUBLIC_`

## 4. Deploy edge functions

```bash
supabase functions deploy calculate-trust-score
supabase functions deploy match-businesses
supabase functions deploy verify-business-passport
supabase functions deploy admin-verification
supabase functions deploy create-opportunity
supabase functions deploy notification-engine
supabase functions deploy audit-logger
supabase functions deploy generate-business-passport-pdf
supabase functions deploy bulk-import
supabase functions deploy compliance-monitor --no-verify-jwt
```

Set function secrets (they don't inherit `.env.local`):

```bash
supabase secrets set RESEND_API_KEY=... OPENROUTER_API_KEY=...
```

## 5. Schedule compliance-monitor

In the Supabase SQL editor, using `pg_cron` (enable the extension first):

```sql
select cron.schedule(
  'sithelo-compliance-monitor',
  '0 4 * * *', -- 06:00 SAST (UTC+2)
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.functions.supabase.co/compliance-monitor',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
  );
  $$
);
```

## 6. Seed local data (optional)

`supabase/seed.sql` has commented examples — it requires real `auth.users` rows to exist first (profiles/passports have a hard FK to `auth.users.id`, by design, so no fake UUIDs). Create test users via Supabase Studio → Authentication, then uncomment and fill in real UUIDs.

## 7. Auth redirect URLs

In Authentication → URL Configuration, add:
- Site URL: your production domain
- Redirect URLs: `https://yourdomain.com/auth/callback`, `http://localhost:3000/auth/callback`

This is the exact misconfiguration that broke `signUp()` in production on an earlier Zenzele Holdings project (Ubulula) — a malformed Site URL causes GoTrue to build a broken confirmation link. Double-check this value has no trailing slash and matches exactly.

## 8. Pre-launch security checklist

Before going live, in the Supabase dashboard:

- **Auth > Providers > Email**: enable CAPTCHA protection (hCaptcha/Turnstile). This is the effective rate limiter for public register/login, because those calls go directly from the browser to Supabase Auth and never touch the Next.js app — page-level rate limiting would be theater. Supabase Auth also applies built-in per-email rate limits; leave them at defaults.
- **Auth > URL Configuration**: confirm Site URL and redirect URLs (step 7 above).
- **Database**: `supabase db push` to apply migrations 032–034 (institution read-surface narrowing, client-write locks, onboarding role guard), then run the pgTAP suite (`supabase test db`, see `SECURITY_TESTS.md`) against a staging project before production.
- **Edge Functions**: redeploy the functions changed in the audit-fix pass — `audit-logger`, `notification-engine`, `admin-verification`, `bulk-import`, `compliance-monitor` (see step 4). Note `notification-engine` now requires a `context` field in its payload; no existing callers are affected (it had none).
- **Resend**: verify `notifications@sithelo.co.za` (or your chosen sender address) is verified as a sending domain, or notification emails silently fail.
