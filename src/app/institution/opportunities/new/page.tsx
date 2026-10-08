import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloButton } from "@/components/ui/sithelo";

// ====================================================================
// /institution/opportunities/new
//
// Collects the fields the schema supports and posts through the
// create-opportunity Edge Function (the sole authority: it derives
// institution_id/created_by from the caller's session and rate limits).
//
// In addition to the legacy requirements JSONB, providers now specify
// structured, categorised requirements (eligibility / practical fit /
// readiness) that the matching engine uses to compute a five-dimension
// match and — crucially — to distinguish eligibility from practical
// friction (e.g. "weekday attendance" vs "laptop required").
// ====================================================================

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

async function createOpportunityAction(formData: FormData) {
  "use server";
  await requireInstitution();
  const supabase = await createClient();

  const requirements: Record<string, unknown> = {};
  const industry = String(formData.get("req_industry") ?? "").trim();
  const minTrust = formData.get("req_min_trust");
  const bbbee = String(formData.get("req_bbbee") ?? "").trim();
  if (industry) requirements.industry = industry;
  if (minTrust) requirements.min_trust_score = Number(minTrust);
  if (bbbee) requirements.bbbee_level = bbbee;

  // Structured, categorised requirements (the matching engine's source).
  const structured: Array<{ key: string; value: string | number | boolean; category: string }> = [];
  const flag = (key: string, category: string) => {
    if (formData.get(key) === "on") structured.push({ key, value: true, category });
  };
  const choice = (key: string, category: string) => {
    const v = String(formData.get(key) ?? "").trim();
    if (v) structured.push({ key, value: v, category });
  };
  const number = (key: string, category: string) => {
    const v = String(formData.get(key) ?? "").trim();
    if (v) {
      const n = Number(v);
      if (Number.isFinite(n)) structured.push({ key, value: n, category });
    }
  };

  // Eligibility
  flag("req_cipc", "eligibility");
  flag("req_vat", "eligibility");
  flag("req_sars", "eligibility");
  number("req_min_years", "eligibility");

  // Practical fit
  choice("req_schedule", "practical_fit");
  choice("req_delivery", "practical_fit");
  choice("req_device", "practical_fit");
  number("req_hours", "practical_fit");
  number("req_duration", "practical_fit");
  number("req_contribution", "practical_fit");
  flag("req_travel", "practical_fit");

  // Readiness
  number("req_stage_min", "readiness");
  number("req_revenue", "readiness");
  flag("req_capacity", "readiness");
  flag("req_staffing", "readiness");
  flag("req_funding", "readiness");
  flag("req_procurement", "readiness");

  const body = {
    title: String(formData.get("title") ?? "").trim(),
    opportunity_type: String(formData.get("opportunity_type") ?? "procurement"),
    category: String(formData.get("category") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim(),
    province: String(formData.get("province") ?? "").trim() || undefined,
    municipality: String(formData.get("municipality") ?? "").trim() || undefined,
    businesses_needed: formData.get("businesses_needed") ? Number(formData.get("businesses_needed")) : undefined,
    value_estimate: formData.get("value_estimate") ? Number(formData.get("value_estimate")) : undefined,
    closing_date: String(formData.get("closing_date") ?? "").trim() || undefined,
    requirements,
    structured_requirements: structured,
    status: "active",
  };

  const { data, error } = await supabase.functions.invoke("create-opportunity", { body });
  if (error || !data?.opportunity?.id) {
    redirect("/institution/opportunities/new?error=1");
  }
  redirect(`/institution/opportunities/${data.opportunity.id}`);
}

export default async function NewOpportunityPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { profile } = await requireInstitution();
  const supabase = await createClient();

  const NAV_ITEMS = [
    { label: "Home", href: "/institution/dashboard" },
    { label: "Discover Businesses", href: "/institution/search" },
    { label: "Opportunities", href: "/institution/opportunities", active: true },
    { label: "Applications", href: "/institution/applications" },
  ];

  let approvalStatus: string | null = null;
  if (profile.role === "institution" && profile.institution_id) {
    const { data: institution } = await supabase
      .from("institutions")
      .select("approval_status")
      .eq("id", profile.institution_id)
      .single();
    approvalStatus = institution?.approval_status ?? null;
  }

  if (approvalStatus && approvalStatus !== "approved") {
    return (
      <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Institution">
        <div className="mb-10 rule border-b pb-8">
          <div className="eyebrow mb-3">Institution</div>
          <h1 className="text-display-lg font-display font-medium text-navy leading-tight">Post an opportunity</h1>
        </div>
        <div className="card max-w-xl">
          {approvalStatus === "pending" ? (
            <>
              <p className="text-sm font-medium text-navy mb-1.5">Your institution is awaiting review</p>
              <p className="text-sm text-ink-600">
                Sithelo reviews new institutions before they can publish opportunities. You&apos;ll be notified as soon as your institution is approved.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-navy mb-1.5">Your institution registration was not approved</p>
              <p className="text-sm text-ink-600">
                Contact Sithelo for more information about your institution&apos;s review outcome.
              </p>
            </>
          )}
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Institution">
      <div className="mb-10 rule border-b pb-8">
        <div className="eyebrow mb-3">Institution</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">Post an opportunity</h1>
        <p className="text-ink-600 mt-2">Sithelo will find matching businesses as soon as this is posted.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-6">We couldn&apos;t post that opportunity. Please check the required fields and try again.</p>
      )}

      <form action={createOpportunityAction} className="space-y-10 max-w-2xl">
        <div>
          <div className="eyebrow mb-4">What are you looking for?</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="text-xs text-ink-500 block mb-1.5">Title</label>
              <input id="title" name="title" required maxLength={200} className="input" />
            </div>
            <div>
              <label htmlFor="opportunity_type" className="text-xs text-ink-500 block mb-1.5">Type</label>
              <select id="opportunity_type" name="opportunity_type" className="input">
                <option value="procurement">Procurement</option>
                <option value="funding">Funding</option>
                <option value="enterprise_development">Enterprise Development</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>
            <div>
              <label htmlFor="category" className="text-xs text-ink-500 block mb-1.5">Category (optional)</label>
              <input id="category" name="category" maxLength={100} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="text-xs text-ink-500 block mb-1.5">Description</label>
              <textarea id="description" name="description" required rows={4} maxLength={5000} className="input" />
            </div>
          </div>
        </div>

        <div className="rule border-t pt-8">
          <div className="eyebrow mb-4">Where?</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="province" className="text-xs text-ink-500 block mb-1.5">Province</label>
              <select id="province" name="province" className="input">
                <option value="">Any</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="municipality" className="text-xs text-ink-500 block mb-1.5">Municipality (optional)</label>
              <input id="municipality" name="municipality" maxLength={100} className="input" />
            </div>
          </div>
        </div>

        <div className="rule border-t pt-8">
          <div className="eyebrow mb-4">How many, and what value?</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="businesses_needed" className="text-xs text-ink-500 block mb-1.5">Businesses needed</label>
              <input id="businesses_needed" name="businesses_needed" type="number" min={1} className="input" />
            </div>
            <div>
              <label htmlFor="value_estimate" className="text-xs text-ink-500 block mb-1.5">Estimated value (R, optional)</label>
              <input id="value_estimate" name="value_estimate" type="number" min={0} className="input" />
            </div>
          </div>
        </div>

        <div className="rule border-t pt-8">
          <div className="eyebrow mb-4">When?</div>
          <label htmlFor="closing_date" className="text-xs text-ink-500 block mb-1.5">Closing date</label>
          <input id="closing_date" name="closing_date" type="date" className="input max-w-xs" />
        </div>

        <div className="rule border-t pt-8">
          <div className="eyebrow mb-4">Eligibility — what must the business have?</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="req_industry" className="text-xs text-ink-500 block mb-1.5">Industry</label>
              <input id="req_industry" name="req_industry" className="input" />
            </div>
            <div>
              <label htmlFor="req_min_trust" className="text-xs text-ink-500 block mb-1.5">Minimum trust score</label>
              <input id="req_min_trust" name="req_min_trust" type="number" min={0} max={100} className="input" />
            </div>
            <div>
              <label htmlFor="req_bbbee" className="text-xs text-ink-500 block mb-1.5">B-BBEE level (optional)</label>
              <input id="req_bbbee" name="req_bbbee" className="input" />
            </div>
            <div>
              <label htmlFor="req_min_years" className="text-xs text-ink-500 block mb-1.5">Minimum years trading</label>
              <input id="req_min_years" name="req_min_years" type="number" min={0} className="input" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_cipc" name="req_cipc" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_cipc" className="text-sm text-ink-600">CIPC registration required</label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_vat" name="req_vat" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_vat" className="text-sm text-ink-600">VAT registration required</label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_sars" name="req_sars" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_sars" className="text-sm text-ink-600">SARS tax clearance required</label>
            </div>
          </div>
        </div>

        <div className="rule border-t pt-8">
          <div className="eyebrow mb-4">Practical details — how is it delivered?</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="req_schedule" className="text-xs text-ink-500 block mb-1.5">Schedule</label>
              <select id="req_schedule" name="req_schedule" className="input">
                <option value="">Any</option>
                <option value="weekday">Weekday</option>
                <option value="evening">Evening</option>
                <option value="weekend">Weekend</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <div>
              <label htmlFor="req_delivery" className="text-xs text-ink-500 block mb-1.5">Delivery</label>
              <select id="req_delivery" name="req_delivery" className="input">
                <option value="">Any</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
                <option value="physical">In person</option>
              </select>
            </div>
            <div>
              <label htmlFor="req_device" className="text-xs text-ink-500 block mb-1.5">Device required</label>
              <select id="req_device" name="req_device" className="input">
                <option value="">Any</option>
                <option value="smartphone">Smartphone</option>
                <option value="laptop">Laptop</option>
              </select>
            </div>
            <div>
              <label htmlFor="req_hours" className="text-xs text-ink-500 block mb-1.5">Hours per week</label>
              <input id="req_hours" name="req_hours" type="number" min={0} className="input" />
            </div>
            <div>
              <label htmlFor="req_duration" className="text-xs text-ink-500 block mb-1.5">Duration (weeks)</label>
              <input id="req_duration" name="req_duration" type="number" min={0} className="input" />
            </div>
            <div>
              <label htmlFor="req_contribution" className="text-xs text-ink-500 block mb-1.5">Participant contribution (R)</label>
              <input id="req_contribution" name="req_contribution" type="number" min={0} className="input" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_travel" name="req_travel" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_travel" className="text-sm text-ink-600">Travel required</label>
            </div>
          </div>
        </div>

        <div className="rule border-t pt-8">
          <div className="eyebrow mb-4">Readiness — what must the business be able to do?</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="req_stage_min" className="text-xs text-ink-500 block mb-1.5">Minimum journey stage (1–10)</label>
              <input id="req_stage_min" name="req_stage_min" type="number" min={1} max={10} className="input" />
            </div>
            <div>
              <label htmlFor="req_revenue" className="text-xs text-ink-500 block mb-1.5">Minimum monthly revenue (R)</label>
              <input id="req_revenue" name="req_revenue" type="number" min={0} className="input" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_capacity" name="req_capacity" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_capacity" className="text-sm text-ink-600">Delivery capacity required</label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_staffing" name="req_staffing" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_staffing" className="text-sm text-ink-600">Staff/team required</label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_funding" name="req_funding" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_funding" className="text-sm text-ink-600">Funding-readiness required</label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_procurement" name="req_procurement" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_procurement" className="text-sm text-ink-600">Procurement-readiness required</label>
            </div>
          </div>
        </div>

        <SitheloButton type="submit">Post opportunity</SitheloButton>
      </form>
    </PortalShell>
  );
}
