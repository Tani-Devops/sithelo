import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloBadge, SitheloRing } from "@/components/ui/sithelo";
import Link from "next/link";

// ====================================================================
// DATA SOURCE: public.institution_business_directory (migration 007) —
// NOT business_passports directly. This view already excludes
// head_office_address/business_email/business_phone/key_clients/
// annual_turnover at the column level (see DATA_CLASSIFICATION.md).
// Filters (industry, province) are real column filters against this
// view, not invented — every filter here maps to an actual column that
// exists in the view. "Business requirements"/"opportunity type"
// filters from the brief are NOT built: there's no capability/asset
// model in the schema to filter businesses by yet (see ROADMAP.md),
// so adding those controls would be exactly the "invented feature"
// the brief prohibits.
// ====================================================================

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

const NAV_ITEMS = [
  { label: "Home", href: "/institution/dashboard" },
  { label: "Discover Businesses", href: "/institution/search", active: true },
  { label: "Opportunities", href: "/institution/opportunities" },
];

export default async function BusinessDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; province?: string; q?: string }>;
}) {
  const { profile } = await requireInstitution();
  const { industry, province, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("institution_business_directory")
    .select("*")
    .order("trust_score", { ascending: false })
    .limit(30);

  if (industry) query = query.eq("industry", industry);
  if (province) query = query.eq("province", province);
  if (q) query = query.ilike("business_name", `%${q}%`);

  const { data: businesses, error } = await query;

  const { data: industryRows } = await supabase.from("institution_business_directory").select("industry").not("industry", "is", null);
  const industries = Array.from(new Set((industryRows ?? []).map((r) => r.industry))).sort();

  return (
    <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Procurement Officer">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Discover Businesses</h1>
        <p className="text-ink-600 mt-1">Find the right South African business: verified, compliant, ready to work.</p>
      </div>

      <form method="get" className="card mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-ink-600 mb-1.5">Search by name</label>
          <input name="q" defaultValue={q ?? ""} placeholder="Business name" className="input" />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-ink-600 mb-1.5">Industry</label>
          <select name="industry" defaultValue={industry ?? ""} className="input">
            <option value="">All industries</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-ink-600 mb-1.5">Province</label>
          <select name="province" defaultValue={province ?? ""} className="input">
            <option value="">All provinces</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">Search</button>
      </form>

      {error && <p className="text-sm text-ink-600 text-center py-14">We couldn&apos;t load businesses right now. Please try again.</p>}

      {!error && (!businesses || businesses.length === 0) && (
        <SitheloEmptyState
          title="No businesses match your search"
          body="Try widening your filters, or check back soon. New verified businesses join Sithelo regularly."
        />
      )}

      {!error && businesses && businesses.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {businesses.map((b) => (
            <Link key={b.id} href={`/passport/${b.id}`} className="card hover:shadow-glow transition-shadow flex gap-4">
              <SitheloRing value={b.trust_score} size={56} sublabel="" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-semibold text-navy text-sm truncate">{b.business_name}</h2>
                  {b.overall_verification_status === "verified" && <SitheloBadge tone="verified">✓</SitheloBadge>}
                </div>
                <div className="text-xs text-ink-600 mb-2">{b.industry ?? "—"} · {b.municipality ?? b.province ?? "—"}</div>
                <p className="text-xs text-ink-600 line-clamp-2">{b.business_description ?? "No description provided."}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
