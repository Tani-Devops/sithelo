import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloButton } from "@/components/ui/sithelo";

// ====================================================================
// /institution/opportunities/new
//
// The form only collects fields the schema actually supports
// (supabase/functions/_shared/schemas.ts: createOpportunitySchema) —
// no fabricated filters (directive §28). Submission goes through the
// existing create-opportunity Edge Function, which remains the sole
// authority: it derives institution_id/created_by from the caller's
// verified session (never trusts the form body for those), rate
// limits, and triggers match-businesses server-side. This page does
// not talk to the database directly for the write.
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
  const cipcRequired = formData.get("req_cipc") === "on";
  if (industry) requirements.industry = industry;
  if (minTrust) requirements.min_trust_score = Number(minTrust);
  if (bbbee) requirements.bbbee_level = bbbee;
  if (cipcRequired) requirements.cipc_required = true;

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

  const NAV_ITEMS = [
    { label: "Home", href: "/institution/dashboard" },
    { label: "Discover Businesses", href: "/institution/search" },
    { label: "Opportunities", href: "/institution/opportunities", active: true },
  ];

  return (
    <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Institution">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Post an opportunity</h1>
        <p className="text-ink-600 mt-1">Sithelo will find matching businesses as soon as this is posted.</p>
      </div>

      {error && (
        <div className="card mb-6 border border-red-200">
          <p className="text-sm text-red-600">We couldn&apos;t post that opportunity. Please check the required fields and try again.</p>
        </div>
      )}

      <form action={createOpportunityAction} className="card space-y-6 max-w-2xl">
        <div>
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">What are you looking for?</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="title" className="text-xs text-ink-600 block mb-1">Title</label>
              <input id="title" name="title" required maxLength={200} className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
            <div>
              <label htmlFor="opportunity_type" className="text-xs text-ink-600 block mb-1">Type</label>
              <select id="opportunity_type" name="opportunity_type" className="w-full border border-line rounded-lg p-3 text-sm">
                <option value="procurement">Procurement</option>
                <option value="funding">Funding</option>
                <option value="enterprise_development">Enterprise Development</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>
            <div>
              <label htmlFor="category" className="text-xs text-ink-600 block mb-1">Category (optional)</label>
              <input id="category" name="category" maxLength={100} className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
            <div className="col-span-2">
              <label htmlFor="description" className="text-xs text-ink-600 block mb-1">Description</label>
              <textarea id="description" name="description" required rows={4} maxLength={5000} className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">Where?</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="province" className="text-xs text-ink-600 block mb-1">Province</label>
              <select id="province" name="province" className="w-full border border-line rounded-lg p-3 text-sm">
                <option value="">Any</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="municipality" className="text-xs text-ink-600 block mb-1">Municipality (optional)</label>
              <input id="municipality" name="municipality" maxLength={100} className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">How many, and what value?</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="businesses_needed" className="text-xs text-ink-600 block mb-1">Businesses needed</label>
              <input id="businesses_needed" name="businesses_needed" type="number" min={1} className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
            <div>
              <label htmlFor="value_estimate" className="text-xs text-ink-600 block mb-1">Estimated value (R, optional)</label>
              <input id="value_estimate" name="value_estimate" type="number" min={0} className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">When?</div>
          <label htmlFor="closing_date" className="text-xs text-ink-600 block mb-1">Closing date</label>
          <input id="closing_date" name="closing_date" type="date" className="w-full border border-line rounded-lg p-3 text-sm max-w-xs" />
        </div>

        <div>
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">What must the business have?</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="req_industry" className="text-xs text-ink-600 block mb-1">Industry</label>
              <input id="req_industry" name="req_industry" className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
            <div>
              <label htmlFor="req_min_trust" className="text-xs text-ink-600 block mb-1">Minimum trust score</label>
              <input id="req_min_trust" name="req_min_trust" type="number" min={0} max={100} className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
            <div>
              <label htmlFor="req_bbbee" className="text-xs text-ink-600 block mb-1">B-BBEE level (optional)</label>
              <input id="req_bbbee" name="req_bbbee" className="w-full border border-line rounded-lg p-3 text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="req_cipc" name="req_cipc" type="checkbox" className="h-4 w-4" />
              <label htmlFor="req_cipc" className="text-sm text-ink-600">CIPC registration required</label>
            </div>
          </div>
        </div>

        <SitheloButton type="submit">Post opportunity</SitheloButton>
      </form>
    </PortalShell>
  );
}
