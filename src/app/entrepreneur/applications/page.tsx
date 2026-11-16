import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloStatus } from "@/components/ui/sithelo";
import { formatDate, formatRand } from "@/lib/format";

// Every application the entrepreneur has made, newest first. Until now an
// application was only visible from its own opportunity page. RLS limits
// applications to the caller's own passport; the opportunity join reads
// whatever opportunity fields RLS lets an entrepreneur see.

const STATUS_HELP: Record<string, string> = {
  submitted: "Sent. The institution hasn't opened it yet.",
  under_review: "The institution is reviewing it.",
  shortlisted: "You're on the shortlist.",
  awarded: "Awarded. The institution will be in touch.",
  rejected: "Not successful this time.",
  withdrawn: "You withdrew this application.",
};

export default async function EntrepreneurApplicationsPage() {
  const { userId, profile } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: passport } = await supabase
    .from("business_passports")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  const { data: applications, error } = passport
    ? await supabase
        .from("applications")
        .select("id, status, created_at, reviewed_at, opportunity_id, opportunities(title, opportunity_type, value_estimate, closing_date, institutions(name))")
        .eq("passport_id", passport.id)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  type Opp = {
    title: string;
    opportunity_type: string;
    value_estimate: number | null;
    closing_date: string | null;
    institutions: { name: string } | { name: string }[] | null;
  };
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  const active = (applications ?? []).filter((a) => ["submitted", "under_review", "shortlisted"].includes(a.status)).length;

  return (
    <PortalShell portal="entrepreneur" userName={profile.full_name}>
      <div className="mb-10 rule border-b pb-8">
        <div className="eyebrow mb-3">Applications</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">Your applications</h1>
        {applications && applications.length > 0 && (
          <p className="text-ink-600 mt-2">{active} in progress, {applications.length} in total.</p>
        )}
      </div>

      {error && <p className="text-sm text-ink-600 py-10">We couldn&apos;t load your applications right now. Please try again.</p>}

      {!error && (!applications || applications.length === 0) && (
        <SitheloEmptyState
          title={passport ? "You haven't applied to anything yet" : "Start with your Business Passport"}
          body={
            passport
              ? "Browse the opportunities matched to your business and apply in a few clicks."
              : "You need a Business Passport before you can apply to opportunities."
          }
          actionLabel={passport ? "Browse opportunities" : "Create your Business Passport"}
          actionHref={passport ? "/entrepreneur/opportunities" : "/entrepreneur/business/new"}
        />
      )}

      {!error && applications && applications.length > 0 && (
        <ul className="rule border-t">
          {applications.map((app) => {
            const opp = one(app.opportunities as unknown as Opp | Opp[] | null);
            const inst = one(opp?.institutions);
            return (
              <li key={app.id} className="border-b border-line">
                <Link
                  href={`/entrepreneur/opportunities/${app.opportunity_id}`}
                  className="grid sm:grid-cols-[1fr_auto] gap-x-8 gap-y-3 py-6 group"
                >
                  <div className="min-w-0">
                    <div className="font-display font-medium text-navy text-lg leading-snug group-hover:text-blue-600 transition-colors">
                      {opp?.title ?? "Opportunity no longer available"}
                    </div>
                    <div className="text-sm text-ink-600 mt-1">
                      {[inst?.name, opp?.value_estimate ? formatRand(opp.value_estimate) : null, `Applied ${formatDate(app.created_at)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <p className="text-sm text-ink-500 mt-2">{STATUS_HELP[app.status] ?? ""}</p>
                  </div>
                  <div className="sm:text-right">
                    <SitheloStatus status={app.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PortalShell>
  );
}
