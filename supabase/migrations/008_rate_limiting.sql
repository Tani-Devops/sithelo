-- ====================================================================
-- Rate limiting infrastructure
-- ====================================================================
-- Supabase Auth already rate-limits login/registration/password-reset/
-- OTP at the platform level (documented in RATE_LIMITING.md, not
-- reimplemented here — duplicating it would just be two systems that
-- can disagree). This migration covers everything Auth doesn't:
-- application-level actions (opportunity creation, bulk import, PDF
-- generation, messaging, document access) that have real cost (compute,
-- storage, or being a spam vector) and no built-in protection.
--
-- Design: a single table + one atomic function, callable from edge
-- functions (via RPC) and from Next.js Route Handlers (via the service
-- client). No external service — this is deliberately just Postgres,
-- per the constraint of using Supabase-native capabilities where
-- practical.

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,        -- e.g. 'bulk-import:admin:<uuid>' or 'documents:ip:1.2.3.4'
  window_start timestamptz not null default now(),
  request_count int not null default 1
);

create unique index idx_rate_limits_key_window on public.rate_limits (rate_key, window_start);
create index idx_rate_limits_key on public.rate_limits (rate_key);

alter table public.rate_limits enable row level security;
-- No policies granted to `authenticated` at all — this table is written
-- and read exclusively via the SECURITY DEFINER function below, never
-- queried directly by client code.

-- Fixed-window counter. Returns true if the request is allowed (and
-- atomically increments the count), false if the limit is already hit
-- for the current window. Old windows aren't cleaned up here — add a
-- scheduled `delete from rate_limits where window_start < now() -
-- interval '1 day'` via pg_cron alongside compliance-monitor's schedule.
create or replace function public.check_rate_limit(
  p_key text,
  p_max_requests int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_current_count int;
begin
  -- Bucket to the start of the current fixed window, e.g. window_seconds=60
  -- rounds 14:32:45 down to 14:32:00 — every caller within the same
  -- 60-second bucket shares one counter row.
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (rate_key, window_start, request_count)
  values (p_key, v_window_start, 1)
  on conflict (rate_key, window_start)
  do update set request_count = rate_limits.request_count + 1
  returning request_count into v_current_count;

  return v_current_count <= p_max_requests;
end;
$$;

comment on function public.check_rate_limit is
  'Fixed-window rate limiter. Call before performing the rate-limited action, not after — check_rate_limit(''bulk-import:'' || auth.uid(), 5, 3600) allows 5 calls per rolling-hour-bucket per admin. Returns false when the caller should be rejected with 429.';

-- Callable by authenticated users (edge functions call it via the
-- service role, which also has execute access) — the function itself is
-- SECURITY DEFINER so it can write to rate_limits despite that table
-- having no direct grants.
grant execute on function public.check_rate_limit(text, int, int) to authenticated, service_role;
