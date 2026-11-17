import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloBadge, SitheloRing } from "@/components/ui/sithelo";
import Link from "next/link";

// ====================================================================
// DATA SOURCE: public.institution_business_directory (migration 007) —
// NOT business_passports directly. This view already excludes
// head_office_address/business_email/business_phone/key_clients/
// annual_turnover at the column level (see docs/architecture/DATA_CLASSIFICATION.md).
// Filters (industry, province) are real column filters against this
// view, not invented — every filter here maps to an actual column that
// exists in the view. "Business requirements"/"opportunity type"
// filters from the brief are NOT built: there's no capability/asset
// model in the schema to filter businesses by yet (see docs/product/ROADMAP.md),
// so adding those controls would be exactly the "invented feature"
// the brief prohibits.
// ====================================================================

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];


export default async function BusinessDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; province?: string; q?: string; shortlisted?: string }>;
}) {
  const { profile } = await requireInstitution();
  const { industry, province, q, shortlisted } = await searchParams;
  const onlyShortlisted = shortlisted === "1";
  const supabase = await createClient();

  // RLS limits shortlists to the caller's own institution (018).
  const { data: shortlistRows } = await supabase
    .from("shortlists")
    .select("passport_id")
    .eq("institution_id", profile.institution_id ?? "00000000-0000-0000-0000-000000000000");
  const shortlistedIds = new Set((shortlistRows ?? []).map((r) => r.passport_id as string));

  let query = supabase
    .from("institution_business_directory")
    .select("*")
    .order("trust_score", { ascending: false })
    .limit(30);

  if (industry) query = query.eq("industry", industry);
  if (province) query = query.eq("province", province);
  // Escape LIKE wildcards so a search for "100%" means the literal text.
  if (q) query = query.ilike("business_name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (onlyShortlisted) {
    query = query.in("id", shortlistedIds.size ? [...shortlistedIds] : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: businesses, error } = await query;

  const { data: industryRows } = await supabase.from("institution_business_directory").select("industry").not("industry", "is", null);
  const industries = Array.from(new Set((industryRows ?? []).map((r) => r.industry))).sort();

  return (
    <PortalShell portal="institution" userName={profile.full_name}>
      <div className="mb-8 rule border-b pb-8">
        <div className="eyebrow mb-3">Discover Businesses</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">Find the right South African business.</h1>
        <p className="text-ink-600 mt-2">Discover businesses with verification and compliance information.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-4 mb-10">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="q" className="block text-xs font-medium text-ink-500 mb-1.5">Search by name</label>
          <input id="q" name="q" defaultValue={q ?? ""} placeholder="Business name" className="input" />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="industry" className="block text-xs font-medium text-ink-500 mb-1.5">Industry</label>
          <select id="industry" name="industry" defaultValue={industry ?? ""} className="input">
            <option value="">All industries</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="province" className="block text-xs font-medium text-ink-500 mb-1.5">Province</label>
          <select id="province" name="province" defaultValue={province ?? ""} className="input">
            <option value="">All provinces</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-600 pb-2.5">
          <input type="checkbox" name="shortlisted" value="1" defaultChecked={onlyShortlisted} className="h-4 w-4" />
          Shortlisted only ({shortlistedIds.size})
        </label>
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0 rule border-t">
          {businesses.map((b) => (
            <Link key={b.id} href={`/passport/${b.id}`} className="flex gap-4 py-6 border-b border-line group">
              <SitheloRing value={b.trust_score} size={52} sublabel="" surface="light" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-medium text-navy text-sm truncate group-hover:text-blue-600 transition-colors">{b.business_name}</h2>
                  {b.overall_verification_status === "verified" && <SitheloBadge tone="verified">✓</SitheloBadge>}
                  {shortlistedIds.has(b.id) && <SitheloBadge tone="info">Shortlisted</SitheloBadge>}
                </div>
                <div className="text-xs text-ink-500 mb-2">{b.industry ?? "—"} · {b.municipality ?? b.province ?? "—"}</div>
                <p className="text-xs text-ink-600 line-clamp-2">{b.business_description ?? "No description provided."}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
