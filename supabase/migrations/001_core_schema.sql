-- ====================================================================
-- ZENZELE CORE SCHEMA
-- Migration 001: Tables, enums, indexes
-- ====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
create type user_role as enum ('entrepreneur', 'institution', 'admin');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'expired');
create type business_type as enum ('sole_proprietor', 'private_company', 'close_corporation', 'partnership', 'npo', 'cooperative');
create type opportunity_type as enum ('procurement', 'funding', 'enterprise_development', 'partnership');
create type opportunity_status as enum ('draft', 'active', 'closed', 'awarded', 'cancelled');
create type application_status as enum ('submitted', 'under_review', 'shortlisted', 'awarded', 'rejected', 'withdrawn');
create type document_status as enum ('valid', 'expiring_soon', 'expired', 'pending_review');
create type sa_province as enum (
  'Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo',
  'Mpumalanga','North West','Northern Cape','Western Cape'
);

-- ---------- PROFILES (extends auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'entrepreneur',
  full_name text not null,
  email text not null,
  cell_number text,
  avatar_url text,
  institution_id uuid, -- set if role = institution
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- INSTITUTIONS ----------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution_type text, -- e.g. 'municipality','dfi','sez','corporate','ngo'
  logo_url text,
  primary_contact_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_institution_fk foreign key (institution_id) references public.institutions(id);

-- ---------- BUSINESS PASSPORT (the core entity) ----------
create table public.business_passports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  passport_code text unique not null default ('ZEN-' || extract(year from now()) || '-' || lpad(floor(random()*99999)::text,5,'0')),

  -- Identity
  business_name text not null,
  registration_number text,
  business_type business_type,
  established_year int,
  industry text,
  sub_industry text,

  -- Location
  province sa_province,
  municipality text,
  head_office_address text,

  -- Business information
  business_description text,
  core_services text,
  key_clients text,
  equipment_owned text,
  capacity_range text,
  employees_count int,
  annual_turnover numeric,
  years_trading int,
  website text,
  business_email text,
  business_phone text,
  logo_url text,
  cover_image_url text,

  -- Trust / verification (calculated by calculate-trust-score edge function)
  trust_score int default 0 check (trust_score between 0 and 100),
  business_health_score int default 0 check (business_health_score between 0 and 100),
  readiness_score int default 0 check (readiness_score between 0 and 100),
  profile_completeness int default 0 check (profile_completeness between 0 and 100),
  overall_verification_status verification_status default 'unverified',

  -- BBBEE
  bbbee_level int,
  bbbee_expiry date,

  is_published boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_passports_owner on public.business_passports(owner_id);
create index idx_passports_industry on public.business_passports(industry);
create index idx_passports_province on public.business_passports(province);
create index idx_passports_trust_score on public.business_passports(trust_score desc);

-- ---------- VERIFICATIONS (CIPC, SARS, VAT, CIDB, Municipal, Insurance, Bank) ----------
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  verification_type text not null, -- 'cipc','sars','vat','bbbee','cidb','municipal_supplier','insurance','bank'
  status verification_status not null default 'pending',
  reference_number text,
  issued_date date,
  expiry_date date,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_verifications_passport on public.verifications(passport_id);
create index idx_verifications_expiry on public.verifications(expiry_date) where expiry_date is not null;

-- ---------- DOCUMENTS ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  document_type text not null, -- 'cipc_certificate','tax_clearance','vat_certificate','bbbee_certificate','cidb_certificate','insurance_certificate','bank_confirmation', etc
  file_path text not null, -- storage path in 'passport-documents' bucket
  file_name text not null,
  status document_status not null default 'pending_review',
  issued_date date,
  expiry_date date,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_documents_passport on public.documents(passport_id);

-- ---------- REFERENCES / REVIEWS ----------
create table public.business_references (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  reference_name text not null,
  reference_organisation text,
  reference_contact text,
  project_description text,
  rating numeric(2,1) check (rating between 0 and 5),
  created_at timestamptz not null default now()
);

-- ---------- OPPORTUNITIES ----------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_by uuid references public.profiles(id),
  title text not null,
  opportunity_type opportunity_type not null,
  category text,
  description text,
  province sa_province,
  municipality text,
  businesses_needed int,
  value_estimate numeric,
  closing_date date,
  status opportunity_status not null default 'draft',
  requirements jsonb default '{}'::jsonb, -- bbbee_level, cidb_grade, industry, min_trust_score, etc
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_opportunities_institution on public.opportunities(institution_id);
create index idx_opportunities_status on public.opportunities(status);
create index idx_opportunities_closing on public.opportunities(closing_date);

-- ---------- MATCHES (server-side computed, see match-businesses edge fn) ----------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  match_score numeric(5,2) not null,
  match_tier text not null, -- 'exact','high','good','partial'
  match_reasons jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(opportunity_id, passport_id)
);

create index idx_matches_opportunity on public.matches(opportunity_id, match_score desc);
create index idx_matches_passport on public.matches(passport_id);

-- ---------- APPLICATIONS ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  status application_status not null default 'submitted',
  cover_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(opportunity_id, passport_id)
);

create index idx_applications_opportunity on public.applications(opportunity_id);
create index idx_applications_passport on public.applications(passport_id);

-- ---------- SHORTLISTS (institution saved businesses) ----------
create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(institution_id, passport_id)
);

-- ---------- NOTIFICATIONS ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'in_app', -- 'in_app','email','whatsapp','sms'
  category text not null, -- 'verification','invitation','application','approval','document_expiry','trust_score'
  title text not null,
  body text,
  is_read boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications(recipient_id, is_read);

-- ---------- MESSAGES ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  opportunity_id uuid references public.opportunities(id),
  body text not null,
  is_read boolean default false,
  created_at timestamptz not null default now()
);

create index idx_messages_thread on public.messages(sender_id, recipient_id);

-- ---------- AUDIT LOGS (immutable, written only by audit-logger edge fn) ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  ip_address text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_actor on public.audit_logs(actor_id);

-- ---------- ACTIVITY FEED (per-passport timeline shown on Business Passport page) ----------
create table public.passport_activity (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  activity_type text not null, -- 'applied','document_updated','shortlisted','contract_awarded','verification_updated'
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_passport_activity on public.passport_activity(passport_id, created_at desc);

-- ---------- TRUST SCORE HISTORY (for the sparkline on the passport page) ----------
create table public.trust_score_history (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  score int not null,
  recorded_at timestamptz not null default now()
);

create index idx_trust_history_passport on public.trust_score_history(passport_id, recorded_at);

-- ---------- updated_at trigger helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_passports_updated before update on public.business_passports
  for each row execute function public.set_updated_at();
create trigger trg_opportunities_updated before update on public.opportunities
  for each row execute function public.set_updated_at();
