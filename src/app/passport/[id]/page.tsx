import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentViewer } from "@/components/ui/DocumentViewer";
import { SitheloRing, SitheloBadge, SitheloButton, SitheloLogo } from "@/components/ui/sithelo";

// ====================================================================
// SECURITY-CRITICAL DATA FLOW — UNCHANGED FROM THE PRIOR PASS.
// This rebrand pass only changes markup/styling below. Every RPC call
// (get_passport_detail, get_passport_activity, get_passport_trust_history)
// and the access_tier branching logic is untouched — the brief for this
// pass is explicit that the frontend must never weaken, bypass, or
// reconstruct the backend authorization model, and this page is exactly
// where that matters most. See prior pass comments in migration history
// (015/019) for the full reasoning; not repeated here to avoid this file
// drifting from being primarily about presentation.
// ====================================================================

interface PassportDetail {
  id: string;
  passport_code: string;
  business_name: string;
  business_type: string | null;
  established_year: number | null;
  industry: string | null;
  province: string | null;
  municipality: string | null;
  business_description: string | null;
  core_services: string | null;
  employees_count: number | null;
  years_trading: number | null;
  website: string | null;
  trust_score: number;
  overall_verification_status: string;
  bbbee_level: number | null;
  is_published: boolean;
  verification_summary: Record<string, boolean>;
  access_tier: "owner_admin" | "authorized_institution" | "discovery";
  annual_turnover?: number | null;
  business_health_score?: number;
}

interface ActivityEntry {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

interface TrustHistoryEntry {
  score: number;
  recorded_at: string;
}

const VERIFICATION_LABELS: Record<string, string> = {
  cipc: "CIPC verified", sars: "Tax compliant", vat: "VAT registered", bank: "Bank verified", bbbee: "B-BBEE verified",
  insurance: "Insurance verified", cidb: "CIDB registered", municipal_supplier: "Municipal supplier",
};

export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: passport, error } = await supabase.rpc("get_passport_detail", { p_passport_id: id });
  if (error || !passport) notFound();

  const detail = passport as unknown as PassportDetail;
  const showOwnerAdminData = detail.access_tier === "owner_admin";

  const { data: activityData } = showOwnerAdminData
    ? await supabase.rpc("get_passport_activity", { p_passport_id: id })
    : { data: null };
  const activity = activityData as unknown as ActivityEntry[] | null;

  const { data: historyData } = showOwnerAdminData
    ? await supabase.rpc("get_passport_trust_history", { p_passport_id: id })
    : { data: null };
  const history = historyData as unknown as TrustHistoryEntry[] | null;

  const isVerified = detail.overall_verification_status === "verified";

  return (
    <main className="min-h-screen bg-soft px-6 md:px-8 py-8 max-w-[1200px] mx-auto">
      {/* ---- Credential header — the "digital business credential" treatment ---- */}
      <div className="surface-navy relative overflow-hidden mb-6">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #67C7F2, transparent 70%)" }} />
        <div className="relative flex items-start justify-between mb-8">
          <div className="brightness-0 invert opacity-80"><SitheloLogo height={20} /></div>
          <div className="flex gap-2">
            {showOwnerAdminData && (
              <SitheloButton href="/entrepreneur/business/edit" variant="ghost" className="!bg-white/10 !text-white !border-white/20 hover:!border-sky">Edit</SitheloButton>
            )}
            <SitheloButton variant="ghost" className="!bg-white/10 !text-white !border-white/20 hover:!border-sky">Share Passport</SitheloButton>
            <SitheloButton>Download PDF</SitheloButton>
          </div>
        </div>

        <div className="relative grid grid-cols-[auto_1fr] gap-8 items-center">
          <SitheloRing value={detail.trust_score} label={`${detail.trust_score}`} sublabel="Trust Score" size={120} />
          <div>
            <div className="text-white/50 text-xs font-semibold tracking-wider uppercase mb-2">Business Passport</div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display font-bold text-white">{detail.business_name}</h1>
              {isVerified && <SitheloBadge tone="verified">✓ Verified</SitheloBadge>}
            </div>
            <div className="text-white/60 text-sm">
              {detail.industry ?? "—"} · {detail.municipality ?? "—"}, {detail.province ?? "—"}
              {detail.established_year && ` · Est. ${detail.established_year}`}
            </div>
            <div className="text-white/35 text-xs mt-3">Passport ID: {detail.passport_code}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6 mb-6">
        <div className="card">
          <h2 className="text-sm font-display font-semibold text-navy mb-4">Business Identity</h2>
          <div className="grid grid-cols-2 gap-5 text-sm">
            <div><span className="text-ink-600 block text-xs mb-1">Description</span>{detail.business_description ?? "—"}</div>
            <div><span className="text-ink-600 block text-xs mb-1">Core Services</span>{detail.core_services ?? "—"}</div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-display font-semibold text-navy mb-3">Capabilities</h2>
          <div className="space-y-2.5 text-sm">
            <Row label="Employees" value={detail.employees_count?.toString() ?? "—"} />
            {detail.annual_turnover !== undefined && (
              <Row label="Annual Turnover" value={detail.annual_turnover ? `R${Number(detail.annual_turnover).toLocaleString()}` : "—"} />
            )}
            <Row label="Years Trading" value={detail.years_trading?.toString() ?? "—"} />
            <Row label="B-BBEE Status" value={detail.bbbee_level ? `Level ${detail.bbbee_level}` : "—"} />
            <Row label="Website" value={detail.website ?? "—"} />
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-sm font-display font-semibold text-navy mb-4">Compliance &amp; Verification</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(VERIFICATION_LABELS).map(([key, label]) => {
            const verified = detail.verification_summary?.[key] === true;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className={verified ? "text-teal" : "text-ink-600/50"}>{verified ? "✓" : "○"}</span>
                <span className={`text-sm ${verified ? "text-navy font-medium" : "text-ink-600"}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <DocumentViewer passportId={id} />
        </div>

        {showOwnerAdminData && (
          <div className="card">
            <h2 className="text-sm font-display font-semibold text-navy mb-4">Recent Activity</h2>
            {activity && activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="text-navy">{a.description}</div>
                    <div className="text-xs text-ink-600">{new Date(a.created_at).toLocaleDateString("en-ZA")}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-600">No activity yet.</p>
            )}
          </div>
        )}
      </div>

      {showOwnerAdminData && history && history.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-sm font-display font-semibold text-navy mb-4">Trust Score Over Time</h2>
          <div className="flex items-end gap-2 h-24">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{ height: `${h.score}%`, background: "linear-gradient(180deg, #67C7F2, #3157D5)", opacity: 0.75 }}
                title={`${h.score}`}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-600 text-center mt-8">
        All information has been verified. Sithelo connects institutions with trusted, ready-to-work businesses.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-600">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}
