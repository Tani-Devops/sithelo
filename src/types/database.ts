// Hand-authored to match supabase/migrations/001_core_schema.sql.
// In active development, regenerate via:
//   supabase gen types typescript --project-id <ref> > src/types/database.ts
// and re-apply the JSDoc comments if you want to keep this file as the
// canonical human-readable reference.

export type UserRole = "entrepreneur" | "institution" | "admin";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected" | "expired";
export type BusinessType = "sole_proprietor" | "private_company" | "close_corporation" | "partnership" | "npo" | "cooperative";
export type OpportunityType = "procurement" | "funding" | "enterprise_development" | "partnership";
export type OpportunityStatus = "draft" | "active" | "closed" | "awarded" | "cancelled";
export type ApplicationStatus = "submitted" | "under_review" | "shortlisted" | "awarded" | "rejected" | "withdrawn";
export type DocumentStatus = "valid" | "expiring_soon" | "expired" | "pending_review";
export type SaProvince =
  | "Eastern Cape" | "Free State" | "Gauteng" | "KwaZulu-Natal" | "Limpopo"
  | "Mpumalanga" | "North West" | "Northern Cape" | "Western Cape";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  cell_number: string | null;
  avatar_url: string | null;
  institution_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Institution {
  id: string;
  name: string;
  institution_type: string | null;
  logo_url: string | null;
  primary_contact_id: string | null;
  created_at: string;
}

export interface BusinessPassport {
  id: string;
  owner_id: string;
  passport_code: string;
  business_name: string;
  registration_number: string | null;
  business_type: BusinessType | null;
  established_year: number | null;
  industry: string | null;
  sub_industry: string | null;
  province: SaProvince | null;
  municipality: string | null;
  head_office_address: string | null;
  business_description: string | null;
  core_services: string | null;
  key_clients: string | null;
  equipment_owned: string | null;
  capacity_range: string | null;
  employees_count: number | null;
  annual_turnover: number | null;
  years_trading: number | null;
  website: string | null;
  business_email: string | null;
  business_phone: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  trust_score: number;
  business_health_score: number;
  readiness_score: number;
  profile_completeness: number;
  overall_verification_status: VerificationStatus;
  bbbee_level: number | null;
  bbbee_expiry: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  passport_id: string;
  verification_type: string;
  status: VerificationStatus;
  reference_number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Opportunity {
  id: string;
  institution_id: string;
  created_by: string | null;
  title: string;
  opportunity_type: OpportunityType;
  category: string | null;
  description: string | null;
  province: SaProvince | null;
  municipality: string | null;
  businesses_needed: number | null;
  value_estimate: number | null;
  closing_date: string | null;
  status: OpportunityStatus;
  requirements: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  opportunity_id: string;
  passport_id: string;
  status: ApplicationStatus;
  cover_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  opportunity_id: string;
  passport_id: string;
  match_score: number;
  match_tier: "exact" | "high" | "good" | "partial";
  match_reasons: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  channel: string;
  category: string;
  title: string;
  body: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Document {
  id: string;
  passport_id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  status: DocumentStatus;
  issued_date: string | null;
  expiry_date: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PassportActivity {
  id: string;
  passport_id: string;
  activity_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TrustScoreHistory {
  id: string;
  passport_id: string;
  score: number;
  recorded_at: string;
}

// Table helper: gives each table the full shape postgrest-js's generics
// require (Row/Insert/Update/Relationships) so `.from('table').select()`
// infers real fields instead of collapsing to `never`. Relationships is
// left empty here — it only affects typed nested-select joins, which the
// pages below narrow manually with `Array.isArray(...)` checks instead.
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  // Required by @supabase/supabase-js 2.112+ to resolve the default
  // PostgREST client version when using a hand-authored (not generated)
  // Database type. See node_modules/@supabase/supabase-js's SupabaseClient
  // generic signature if this ever needs revisiting after an upgrade.
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: Table<Profile>;
      institutions: Table<Institution>;
      business_passports: Table<BusinessPassport>;
      verifications: Table<Verification>;
      documents: Table<Document>;
      opportunities: Table<Opportunity>;
      matches: Table<Match>;
      applications: Table<Application>;
      notifications: Table<Notification>;
      passport_activity: Table<PassportActivity>;
      trust_score_history: Table<TrustScoreHistory>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
