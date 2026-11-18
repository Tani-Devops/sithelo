// Illustrative institution search for the public site.
//
// Mirrors the real screen at /institution/search: filters by business
// name, industry and province, results from institution_business_directory
// (name, industry, municipality, overall_verification_status) and the
// shortlist toggle. The businesses are fictional and the figure says so.

const RESULTS: { name: string; place: string; status: "verified" | "review"; shortlisted: boolean }[] = [
  { name: "Karabo Civils (Pty) Ltd", place: "Ekurhuleni", status: "verified", shortlisted: true },
  { name: "Mohale Paving & Stormwater", place: "City of Tshwane", status: "verified", shortlisted: false },
  { name: "Ntsako Plant Hire", place: "Emfuleni", status: "review", shortlisted: false },
];

function Filter({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.8125rem] text-paper/60">{label}</p>
      <p className="mt-1 truncate rounded-[6px] border border-paper/20 bg-paper/[0.06] px-3 py-2 text-[0.9375rem] text-paper">{value}</p>
    </div>
  );
}

export function DirectorySearchExample() {
  return (
    <figure>
      <div
        className="overflow-hidden rounded-[12px] bg-midnight text-paper ring-1 ring-white/10 shadow-[0_24px_48px_-18px_theme(colors.midnight.DEFAULT/55%)]"
        role="img"
        aria-label="Example search: construction businesses in Gauteng, three results, two verified and one under review"
      >
        <div className="h-[3px] bg-copper" aria-hidden="true" />
        <div className="px-5 sm:px-7 pt-6 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-b border-paper/15">
          <div className="col-span-2 sm:col-span-1"><Filter label="Business name" value="Any" /></div>
          <Filter label="Industry" value="Construction" />
          <Filter label="Province" value="Gauteng" />
        </div>
        <p className="px-5 sm:px-7 pt-4 text-[0.8125rem] text-paper/60">3 businesses</p>
        <ul className="px-5 sm:px-7 pb-3 divide-y divide-paper/10">
          {RESULTS.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-display text-[1.125rem] leading-snug truncate">{r.name}</p>
                <p className="text-[0.8125rem] text-paper/65 mt-0.5">Construction, {r.place}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`flex items-center gap-1.5 text-[0.8125rem] font-semibold ${r.status === "verified" ? "text-paper" : "text-paper/70"}`}>
                  <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
                    <circle
                      cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeDasharray={r.status === "verified" ? undefined : "2.6 2.2"}
                    />
                    {r.status === "verified" && (
                      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                  {r.status === "verified" ? "Verified" : "Under review"}
                </span>
                <span className={`text-[0.8125rem] ${r.shortlisted ? "text-copper-light font-semibold" : "text-paper/50"}`}>
                  {r.shortlisted ? "Shortlisted" : "Shortlist"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-[0.9375rem] text-ink-600">
        Illustrative example. These are not real businesses.
      </figcaption>
    </figure>
  );
}
