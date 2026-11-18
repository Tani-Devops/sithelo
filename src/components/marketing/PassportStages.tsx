// The Business Passport as it fills in, one stage per sign-up step.
//
// Every row shown is a real field in the data model (see
// PassportCredential.tsx). The business is the same fictional example as
// the hero card, and the section says so in its caption.

type RowStatus = "review" | "verified";

interface Stage {
  title: string;
  body: string;
  location?: boolean;
  capabilities?: boolean;
  records?: [string, RowStatus][];
  visible: boolean;
}

const STAGES: Stage[] = [
  {
    title: "Create your account",
    body: "Sign up as an entrepreneur. It's free and takes a couple of minutes.",
    visible: false,
  },
  {
    title: "Tell us about your business",
    body: "A short, guided set of questions. Ranges are fine; no CIPC registration is needed to start.",
    location: true,
    capabilities: true,
    visible: false,
  },
  {
    title: "Upload your documents",
    body: "Add what you have. Sithelo reviews each one and records when it expires.",
    location: true,
    capabilities: true,
    records: [["CIPC registration", "review"], ["SARS tax compliance", "review"]],
    visible: false,
  },
  {
    title: "Get seen, and apply",
    body: "Once a document is verified, institutions can find you, and you can apply to opportunities.",
    location: true,
    capabilities: true,
    records: [["CIPC registration", "verified"], ["SARS tax compliance", "verified"]],
    visible: true,
  },
];

function StatusMark({ status }: { status: RowStatus }) {
  if (status === "verified") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-semibold text-paper">
        <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
          <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-semibold text-paper/70">
      <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
        <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.6 2.2" />
      </svg>
      Under review
    </span>
  );
}

export function PassportStages() {
  return (
    <figure>
      <ol className="grid gap-x-6 gap-y-14 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s, i) => (
          <li key={s.title} className="flex flex-col">
            <div
              className="relative overflow-hidden rounded-[12px] bg-midnight text-paper ring-1 ring-midnight/10 min-h-[340px] flex flex-col"
              aria-hidden="true"
            >
              <div className={`h-[3px] ${s.visible ? "bg-copper" : "bg-paper/15"}`} />
              <div className="px-5 pt-5 pb-6 flex flex-col flex-1">
                <p className="text-[0.8125rem] text-paper/60 tabular-nums">SIT-2026-04817</p>
                <p className="font-display text-[1.375rem] leading-tight mt-4">Karabo Civils (Pty) Ltd</p>
                {s.location && <p className="text-[0.875rem] text-paper/70 mt-1">Construction, Ekurhuleni</p>}
                {s.capabilities && (
                  <ul className="flex flex-wrap gap-1.5 mt-4">
                    {["Civil works", "Paving"].map((c) => (
                      <li key={c} className="rounded-[4px] bg-paper/[0.08] px-2 py-0.5 text-[0.8125rem] text-paper/90">{c}</li>
                    ))}
                  </ul>
                )}
                {s.records && (
                  <ul className="mt-5 divide-y divide-paper/10 border-t border-paper/15">
                    {s.records.map(([name, status]) => (
                      <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-[0.875rem] text-paper min-w-0">{name}</span>
                        <StatusMark status={status} />
                      </li>
                    ))}
                  </ul>
                )}
                <p
                  className={`mt-auto pt-6 text-[0.8125rem] font-semibold ${s.visible ? "text-copper-light" : "text-paper/50"}`}
                >
                  {s.visible ? "Visible to institutions" : "Not yet visible to institutions"}
                </p>
              </div>
            </div>
            <h3 className="font-display text-m-title text-midnight mt-6">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="text-[1rem] text-ink-700 mt-2 leading-relaxed max-w-[34ch]">{s.body}</p>
          </li>
        ))}
      </ol>
      <figcaption className="mt-10 text-[0.9375rem] text-ink-600">
        Illustrative example. Karabo Civils is not a real business.
      </figcaption>
    </figure>
  );
}
