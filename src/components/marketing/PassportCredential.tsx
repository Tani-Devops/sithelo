// Illustrative Business Passport for the public site.
//
// Every field shown exists in the data model: business_passports
// (name, municipality, province, industry, bbbee_level, passport_code
// with its SIT- prefix), verifications (per-type status), documents
// (expiry_date, and an expiring_soon status) and business_capabilities.
// There is no numerical score: the public example shows what was checked
// and when it lapses, not a number whose method isn't published.
//
// The data is a fictional example and says so on the credential itself.

type Status = "verified" | "expiring" | "review";

const STATUS: Record<Status, { label: string; className: string; icon: React.ReactNode }> = {
  verified: {
    label: "Verified",
    className: "text-paper",
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
        <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  expiring: {
    label: "Renew soon",
    className: "text-copper-light",
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
        <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.2V8l2.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  review: {
    label: "Under review",
    className: "text-paper/70",
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
        <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.6 2.2" />
      </svg>
    ),
  },
};

const RECORDS: { name: string; detail: string; status: Status }[] = [
  { name: "CIPC registration", detail: "Company documents on file", status: "verified" },
  { name: "SARS tax compliance", detail: "Valid until 30 Jun 2027", status: "verified" },
  { name: "B-BBEE certificate", detail: "Level 2 · expires 14 Jan 2027", status: "expiring" },
  { name: "CIDB grading", detail: "Grade 6 CE · submitted 3 Nov", status: "review" },
];

const CAPABILITIES = ["Civil works", "Paving", "Stormwater", "Plant hire"];

export function PassportCredential() {
  return (
    <figure className="relative">
      <div className="relative overflow-hidden rounded-[10px] bg-midnight text-paper shadow-[0_30px_60px_-30px_rgba(16,35,51,0.55)]">
        {/* Copper rule along the top edge: the credential's one accent. */}
        <div className="h-[3px] bg-copper" aria-hidden="true" />

        <div className="px-6 sm:px-8 pt-6 pb-7">
          <div className="flex flex-col min-[400px]:flex-row min-[400px]:items-start justify-between gap-3">
            <div>
              <p className="m-eyebrow-on-dark">Business Passport</p>
              <p className="text-[0.8125rem] text-paper/60 mt-1.5 tabular-nums whitespace-nowrap">SIT-2026-04817</p>
            </div>
            <p className="self-start inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-paper/25 px-2.5 py-1 text-[0.75rem] font-semibold text-paper">
              <span className="w-1.5 h-1.5 rounded-full bg-copper-light" aria-hidden="true" />
              Visible to institutions
            </p>
          </div>

          <div className="mt-7 pb-6 border-b border-paper/15">
            <p className="font-display text-[1.625rem] sm:text-[1.875rem] leading-tight">Karabo Civils (Pty) Ltd</p>
            <p className="text-[0.9375rem] text-paper/70 mt-1.5">Construction · Ekurhuleni, Gauteng</p>
          </div>

          <ul className="divide-y divide-paper/10" aria-label="Compliance records">
            {RECORDS.map((r) => {
              const s = STATUS[r.status];
              return (
                <li key={r.name} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] text-paper">{r.name}</p>
                    <p className="text-[0.8125rem] text-paper/60 mt-0.5">{r.detail}</p>
                  </div>
                  <p className={`flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-semibold ${s.className}`}>
                    {s.icon}
                    {s.label}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="mt-5">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-paper/60 mb-2.5">Capabilities</p>
            <ul className="flex flex-wrap gap-2">
              {CAPABILITIES.map((c) => (
                <li key={c} className="rounded-[4px] bg-paper/[0.08] px-2.5 py-1 text-[0.8125rem] text-paper/90">{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="text-[0.8125rem] text-ink-600 mt-3">
        Illustrative example. Karabo Civils is not a real business.
      </figcaption>
    </figure>
  );
}
