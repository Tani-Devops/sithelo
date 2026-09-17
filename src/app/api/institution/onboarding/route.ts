// ====================================================================
// POST /api/institution/onboarding
//
// Completes the flow guards.ts's requireInstitution() has always
// pointed to but that never existed: an institution-role user with no
// institution_id lands here from /institution/onboarding, and this
// route creates their institution and links them to it in a single
// transaction via complete_institution_onboarding() (migration 027).
//
// Server-side validation mirrors /api/onboarding/complete: every field
// is re-checked here even though the database function also validates,
// because the function's errors are meant for a developer reading logs,
// not a user reading a form. Ownership (which user, whether they're
// already onboarded, whether they're even an institution account) is
// entirely re-derived server-side inside the RPC from auth.uid() and
// the profiles table -- nothing here is trusted from the request body
// except the institution's own descriptive fields.
// ====================================================================
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SA_PROVINCES = new Set([
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OnboardingBody {
  name: string;
  institution_type?: string;
  province?: string;
  municipality?: string;
  website?: string;
  contact_name?: string;
  contact_email: string;
  contact_phone?: string;
  description?: string;
  focus_area?: string;
}

function clean(s: unknown, max = 500): string | undefined {
  const v = typeof s === "string" ? s.trim() : "";
  return v.length > 0 ? v.slice(0, max) : undefined;
}

export async function POST(req: Request) {
  const { userId, profile } = await requireAuth();

  // Fast, honest error rather than a generic 500 if a non-institution
  // account (or one that's already linked) hits this directly -- the
  // RPC enforces the same thing, but a plain-English response here is
  // better UX than surfacing a Postgres errcode.
  if (profile.role !== "institution") {
    return NextResponse.json({ error: "Only institution accounts can complete institution onboarding." }, { status: 403 });
  }
  if (profile.institution_id) {
    return NextResponse.json({ error: "This account is already linked to an institution." }, { status: 409 });
  }

  let body: OnboardingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = clean(body.name, 200);
  if (!name) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }

  const contactEmail = clean(body.contact_email, 200);
  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    return NextResponse.json({ error: "A valid primary contact email is required." }, { status: 400 });
  }

  const province = body.province && SA_PROVINCES.has(body.province) ? body.province : null;

  // Rate limit: onboarding should only ever run once per account (the
  // RPC itself is idempotency-safe -- a second call fails with
  // already_onboarded -- but limiting attempts also caps retry storms
  // from a broken client).
  const service = createServiceClient();
  const { data: allowed } = await service.rpc("check_rate_limit", {
    p_key: `institution-onboarding:${userId}`,
    p_max_requests: 10,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment and try again." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("complete_institution_onboarding", {
      p_name: name,
      p_institution_type: clean(body.institution_type, 100) ?? null,
      p_province: province,
      p_municipality: clean(body.municipality, 200) ?? null,
      p_website: clean(body.website, 300) ?? null,
      p_contact_name: clean(body.contact_name, 200) ?? null,
      p_contact_email: contactEmail,
      p_contact_phone: clean(body.contact_phone, 50) ?? null,
      p_description: clean(body.description, 2000) ?? null,
      p_focus_area: clean(body.focus_area, 300) ?? null,
    })
    .single();

  if (error || !data) {
    if (error?.message?.includes("already_onboarded") || error?.code === "23505") {
      return NextResponse.json({ error: "This account is already linked to an institution." }, { status: 409 });
    }
    if (error?.message?.includes("not_an_institution_account")) {
      return NextResponse.json({ error: "Only institution accounts can complete institution onboarding." }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not set up your institution account. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ institution_id: (data as { institution_id: string }).institution_id });
}
