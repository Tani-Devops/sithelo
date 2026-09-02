import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloRing, SitheloMetric, SitheloButton, SitheloEmptyState, SitheloBadge } from "@/components/ui/sithelo";

const NAV_ITEMS = [
  { label: "Home", href: "/entrepreneur/dashboard", active: true },
  { label: "Business Passport", href: "/entrepreneur/business" },
  { label: "My Journey", href: "/entrepreneur/journey" },
  { label: "Opportunities", href: "/entrepreneur/opportunities" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function EntrepreneurDashboard() {
  const { userId: user_id, profile } = await requireEntrepreneur();
  const supabase = await createClient();

  // Explicit column list — never select("*") on business_passports;
  // several columns have SELECT revoked from authenticated entirely
  // (migration 017), including for the owner. Unchanged from the prior
  // pass's fix — only the presentation below changed for the rebrand.
  const { data: passport } = await supabase
    .from("business_passports")
    .select("id, trust_score, overall_verification_status, business_name, industry, municipality, province, years_trading")
    .eq("owner_id", user_id)
    .maybeSingle();

  const { data: matches } = passport
    ? await supabase
        .from("matches")
        .select("match_score, opportunities(id, title, opportunity_type, closing_date, businesses_needed)")
        .eq("passport_id", passport.id)
        .order("match_score", { ascending: false })
        .limit(3)
    : { data: [] };

  const { data: applications } = passport
    ? await supabase.from("applications").select("id, status").eq("passport_id", passport.id)
    : { data: [] };

  const { count: unreadMessages } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user_id)
    .eq("is_read", false);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const activeApplications = applications?.filter((a) => a.status === "submitted" || a.status === "under_review").length ?? 0;

  // Reality + Persona — read-only here. Both are written exclusively by
  // /api/onboarding/complete and /api/persona/recompute (service-role);
  // this page never computes or writes either.
  const { data: entrepreneurProfile } = await supabase
    .from("entrepreneur_profiles")
    .select("id")
    .eq("user_id", user_id)
    .maybeSingle();

  const [{ data: persona }, { data: snapshot }, { data: needs }, { data: goals }] = entrepreneurProfile
    ? await Promise.all([
        supabase
          .from("entrepreneur_persona_state")
          .select("persona_number, persona_name, explanation, recommended_focus")
          .eq("entrepreneur_profile_id", entrepreneurProfile.id)
          .maybeSingle(),
        supabase
          .from("entrepreneur_financial_snapshots")
          .select("weekly_revenue_range")
          .eq("entrepreneur_profile_id", entrepreneurProfile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("entrepreneur_needs").select("need_type").eq("entrepreneur_profile_id", entrepreneurProfile.id).order("priority", { ascending: false }).limit(1),
        supabase.from("entrepreneur_goals").select("goal_type").eq("entrepreneur_profile_id", entrepreneurProfile.id).order("priority", { ascending: false }).limit(1),
      ])
    : [{ data: null }, { data: null }, { data: [] }, { data: [] }];

  const REVENUE_LABELS: Record<string, string> = {
    under_1k: "Under R1,000/week", "1k_2_5k": "R1,000–R2,500/week", "2_5k_5k": "R2,500–R5,000/week",
    "5k_10k": "R5,000–R10,000/week", "10k_25k": "R10,000–R25,000/week", "25k_plus": "R25,000+/week",
  };

  return (
    <PortalShell portalLabel="Entrepreneur" navItems={NAV_ITEMS} userName={profile?.full_name ?? "—"} userRole="Entrepreneur">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-navy tracking-tight">{greeting()}, {firstName}.</h1>
        <p className="text-ink-600 mt-1">Let&apos;s turn your effort into opportunity.</p>
      </div>

      {persona && (
        <div className="card mb-8">
          <div className="text-xs font-semibold text-cobalt uppercase tracking-wide mb-1">
            {String(persona.persona_number).padStart(2, "0")}: {persona.persona_name}
          </div>
          <p className="text-sm text-ink-600 leading-relaxed mb-3">{persona.explanation}</p>
          <Link href="/entrepreneur/journey" className="text-sm text-cobalt font-medium">View my journey →</Link>
        </div>
      )}

      {entrepreneurProfile && (snapshot?.weekly_revenue_range || needs?.[0] || goals?.[0]) && (
        <div className="mb-8">
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">Your reality</div>
          <div className="grid grid-cols-3 gap-5">
            {snapshot?.weekly_revenue_range && (
              <div className="card"><SitheloMetric label="Business" value={REVENUE_LABELS[snapshot.weekly_revenue_range] ?? snapshot.weekly_revenue_range} /></div>
            )}
            {needs?.[0] && (
              <div className="card"><SitheloMetric label="Biggest challenge" value={needs[0].need_type.replace(/_/g, " ")} /></div>
            )}
            {goals?.[0] && (
              <div className="card"><SitheloMetric label="Current goal" value={goals[0].goal_type.replace(/_/g, " ")} /></div>
            )}
          </div>
        </div>
      )}

      {!passport ? (
        <SitheloEmptyState
          title="Your Business Passport is almost ready"
          body="Your Business Passport is how institutions find, verify and contract with you. It takes about 10 minutes to set up the basics."
          actionLabel="Get started"
          actionHref="/entrepreneur/business/new"
        />
      ) : (
        <>
          {/* Command-centre summary — the signature treatment: a floating
              navy panel with the verification ring, not a wall of cards. */}
          <div className="surface-navy grid grid-cols-[auto_1fr] gap-8 items-center mb-8">
            <SitheloRing value={passport.trust_score} label={`${passport.trust_score}`} sublabel="Trust Score" size={110} />
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-white/50 text-xs mb-2">Verification</div>
                <SitheloBadge tone={passport.overall_verification_status === "verified" ? "verified" : "pending"}>
                  {passport.overall_verification_status === "verified" ? "Verified" : "In progress"}
                </SitheloBadge>
              </div>
              <div>
                <div className="text-white/50 text-xs mb-1">Opportunities matched</div>
                <div className="text-2xl font-display font-bold text-white">{matches?.length ?? 0}</div>
              </div>
              <div>
                <div className="text-white/50 text-xs mb-1">Applications in progress</div>
                <div className="text-2xl font-display font-bold text-white">{activeApplications}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5 mb-8">
            <div className="card"><SitheloMetric label="Unread messages" value={unreadMessages ?? 0} /></div>
            <div className="card"><SitheloMetric label="Business" value={passport.business_name} /></div>
            <div className="card"><SitheloMetric label="Location" value={`${passport.municipality ?? "—"}, ${passport.province ?? "—"}`} /></div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-semibold text-navy">Opportunities that match you</h2>
              <Link href="/entrepreneur/opportunities" className="text-sm text-cobalt font-medium">View all</Link>
            </div>
            {matches && matches.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {matches.map((m, i) => {
                  const opp = Array.isArray(m.opportunities) ? m.opportunities[0] : m.opportunities;
                  if (!opp) return null;
                  return (
                    <div key={i} className="border border-line rounded-xl p-4 hover:border-sky-deep transition-colors">
                      <div className="text-xs text-teal font-semibold uppercase tracking-wide mb-1">
                        {opp.opportunity_type.replace("_", " ")}
                      </div>
                      <div className="font-display font-semibold text-sm text-navy mb-2">{opp.title}</div>
                      <div className="text-xs text-ink-600 mb-3">
                        {opp.businesses_needed ? `${opp.businesses_needed} businesses needed` : ""}
                        {opp.closing_date ? ` · Closes ${new Date(opp.closing_date).toLocaleDateString("en-ZA")}` : ""}
                      </div>
                      <div className="text-xs font-semibold text-cobalt">{Math.round(m.match_score)}% match</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-600">No opportunities matched yet. Completing your Business Passport improves matching.</p>
            )}
          </div>

          {persona?.recommended_focus && (
            <div className="card mt-6 border-cobalt/30">
              <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-2">Your next step</div>
              <p className="text-sm text-ink-600 mb-4">{persona.recommended_focus}</p>
              <SitheloButton href="/entrepreneur/journey" variant="ghost">Take the next step</SitheloButton>
            </div>
          )}
        </>
      )}
    </PortalShell>
  );
}
