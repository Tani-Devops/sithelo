"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SitheloButton } from "@/components/ui/sithelo";

// ====================================================================
// "Tell Us About Yourself" — directive §5. Six calm screens, not a
// 40-field government form. Posts once, at the end, to
// POST /api/onboarding/complete, which is the only place any of this
// actually gets written (see that route for the security notes).
// ====================================================================

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

const REVENUE_OPTIONS: { value: string; label: string }[] = [
  { value: "under_1k", label: "Under R1,000" },
  { value: "1k_2_5k", label: "R1,000–R2,500" },
  { value: "2_5k_5k", label: "R2,500–R5,000" },
  { value: "5k_10k", label: "R5,000–R10,000" },
  { value: "10k_25k", label: "R10,000–R25,000" },
  { value: "25k_plus", label: "R25,000+" },
];

const CHALLENGE_OPTIONS = [
  { value: "customers", label: "Getting more customers" },
  { value: "markets", label: "Finding markets" },
  { value: "funding", label: "Funding" },
  { value: "equipment", label: "Equipment" },
  { value: "registration", label: "Registration" },
  { value: "compliance", label: "Compliance" },
  { value: "premises", label: "Premises" },
  { value: "transport", label: "Transport" },
  { value: "suppliers", label: "Suppliers" },
  { value: "skills", label: "Skills" },
  { value: "employees", label: "Employees" },
  { value: "digital_tools", label: "Digital tools" },
  { value: "unknown", label: "I don't know yet" },
];

const GOAL_OPTIONS = [
  { value: "grow_revenue", label: "Grow revenue" },
  { value: "first_major_contract", label: "Get my first major contract" },
  { value: "register_business", label: "Register my business" },
  { value: "employ_people", label: "Employ people" },
  { value: "get_equipment", label: "Get equipment" },
  { value: "find_customers", label: "Find customers" },
  { value: "supply_institution", label: "Supply an institution" },
  { value: "become_procurement_ready", label: "Become procurement-ready" },
  { value: "open_premises", label: "Open a premises" },
  { value: "expand", label: "Expand" },
  { value: "stabilise_income", label: "Make my income more stable" },
];

const STEPS = ["You", "Your business", "How it's going", "Your reality", "Your challenge", "Your goal"];

interface FormState {
  province: string;
  municipality: string;
  business_name: string;
  industry: string;
  years_trading: string;
  primary_income_source: boolean | null;
  weekly_revenue_range: string;
  employees_count: string;
  income_consistency: string;
  dependants_count: string;
  household_income_dependency: string;
  operating_location_type: string;
  internet_access: boolean | null;
  electricity_access: boolean | null;
  challenges: string[];
  goal: string;
  goal_custom: string;
}

const initialState: FormState = {
  province: "", municipality: "", business_name: "", industry: "", years_trading: "",
  primary_income_source: null, weekly_revenue_range: "", employees_count: "", income_consistency: "",
  dependants_count: "", household_income_dependency: "", operating_location_type: "",
  internet_access: null, electricity_access: null, challenges: [], goal: "", goal_custom: "",
};

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-sm px-4 py-2 rounded-sm border transition-colors ${
        selected ? "bg-navy text-white border-navy" : "border-line text-ink-600 hover:border-navy"
      }`}
    >
      {children}
    </button>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleChallenge(value: string) {
    setForm((f) => ({
      ...f,
      challenges: f.challenges.includes(value) ? f.challenges.filter((c) => c !== value) : [...f.challenges, value],
    }));
  }

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    const goals = form.goal
      ? [{ goal_type: form.goal, notes: form.goal === "custom" ? form.goal_custom : undefined }]
      : [];
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          province: form.province || undefined,
          municipality: form.municipality || undefined,
          business_name: form.business_name,
          industry: form.industry || undefined,
          years_trading: form.years_trading ? Number(form.years_trading) : undefined,
          primary_income_source: form.primary_income_source ?? undefined,
          weekly_revenue_range: form.weekly_revenue_range || undefined,
          employees_count: form.employees_count ? Number(form.employees_count) : undefined,
          income_consistency: form.income_consistency || undefined,
          dependants_count: form.dependants_count ? Number(form.dependants_count) : undefined,
          household_income_dependency: form.household_income_dependency || undefined,
          operating_location_type: form.operating_location_type || undefined,
          internet_access: form.internet_access ?? undefined,
          electricity_access: form.electricity_access ?? undefined,
          needs: form.challenges,
          goals,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push("/entrepreneur/onboarding/complete");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const canAdvance = (() => {
    if (step === 0) return true; // province/municipality optional
    if (step === 1) return form.business_name.trim().length > 0;
    return true;
  })();

  return (
    <div className="max-w-xl mx-auto">
      {/* Journey indicator */}
      <div
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        className="flex items-center gap-1.5 mb-10"
      >
        {STEPS.map((s, i) => (
          <div key={s} aria-hidden="true" className={`h-[3px] flex-1 ${i <= step ? "bg-navy" : "bg-line"}`} />
        ))}
      </div>

      <div className="card">
        {step === 0 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-display font-medium text-navy">Let&apos;s get to know you.</h1>
            <p className="text-sm text-ink-600">
              Sithelo isn&apos;t only interested in your business. We want to understand where you&apos;re starting from.
              There&apos;s no wrong answer, and you don&apos;t need to be a registered business to begin.
            </p>
            <div>
              <label htmlFor="province" className="block text-sm font-medium text-navy mb-1.5">Province</label>
              <select id="province" className="input" value={form.province} onChange={(e) => set("province", e.target.value)}>
                <option value="">Select province</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="municipality" className="block text-sm font-medium text-navy mb-1.5">Municipality / town</label>
              <input id="municipality" className="input" value={form.municipality} onChange={(e) => set("municipality", e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-display font-medium text-navy">What are you building?</h1>
            <p className="text-sm text-ink-600">
              A person selling food from a street corner is a valid Sithelo user. So is someone doing hair from home,
              repairing phones from a garage, or selling clothing informally.
            </p>
            <div>
              <label htmlFor="business_name" className="block text-sm font-medium text-navy mb-1.5">What do you sell or do?</label>
              <input id="business_name" className="input" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="e.g. Dlamini Foods" required />
            </div>
            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-navy mb-1.5">Industry</label>
              <input id="industry" className="input" value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Catering, hair & beauty, repairs" />
            </div>
            <div>
              <label htmlFor="years_trading" className="block text-sm font-medium text-navy mb-1.5">How many years have you been doing this?</label>
              <input id="years_trading" type="number" min={0} className="input" value={form.years_trading} onChange={(e) => set("years_trading", e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Pill selected={form.primary_income_source === true} onClick={() => set("primary_income_source", true)}>This is my main income</Pill>
              <Pill selected={form.primary_income_source === false} onClick={() => set("primary_income_source", false)}>It&apos;s not my main income</Pill>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-display font-medium text-navy">How is it going?</h1>
            <p className="text-sm text-ink-600">Approximate ranges are fine, no exact figures needed.</p>
            <div>
              <div id="weekly-revenue-label" className="block text-sm font-medium text-navy mb-2">Weekly business income</div>
              <div role="group" aria-labelledby="weekly-revenue-label" className="flex flex-wrap gap-2">
                {REVENUE_OPTIONS.map((r) => (
                  <Pill key={r.value} selected={form.weekly_revenue_range === r.value} onClick={() => set("weekly_revenue_range", r.value)}>{r.label}</Pill>
                ))}
              </div>
            </div>
            <div>
              <div id="income-consistency-label" className="block text-sm font-medium text-navy mb-2">Is revenue consistent or seasonal?</div>
              <div role="group" aria-labelledby="income-consistency-label" className="flex gap-2">
                {["consistent", "seasonal", "unpredictable"].map((c) => (
                  <Pill key={c} selected={form.income_consistency === c} onClick={() => set("income_consistency", c)}>{c[0].toUpperCase() + c.slice(1)}</Pill>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="employees_count" className="block text-sm font-medium text-navy mb-1.5">People working in/with the business</label>
              <input id="employees_count" type="number" min={0} className="input" value={form.employees_count} onChange={(e) => set("employees_count", e.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-display font-medium text-navy">Tell us about your everyday reality.</h1>
            <p className="text-sm text-ink-600 border-l-2 border-blue-600 pl-4 py-1">
              <span className="font-medium text-navy">Why are we asking this? </span>
              We use this to understand the realities affecting your business and recommend more relevant next steps.
              It isn&apos;t shown to institutions unless you explicitly choose to share it. All of this is optional.
            </p>
            <div>
              <label htmlFor="dependants_count" className="block text-sm font-medium text-navy mb-1.5">Number of dependants</label>
              <input id="dependants_count" type="number" min={0} className="input" value={form.dependants_count} onChange={(e) => set("dependants_count", e.target.value)} />
            </div>
            <div>
              <div id="household-dependency-label" className="block text-sm font-medium text-navy mb-2">How much does your household rely on this income?</div>
              <div role="group" aria-labelledby="household-dependency-label" className="flex gap-2">
                {["low", "medium", "high"].map((d) => (
                  <Pill key={d} selected={form.household_income_dependency === d} onClick={() => set("household_income_dependency", d)}>{d[0].toUpperCase() + d.slice(1)}</Pill>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="operating_location_type" className="block text-sm font-medium text-navy mb-1.5">Where do you operate from?</label>
              <select id="operating_location_type" className="input" value={form.operating_location_type} onChange={(e) => set("operating_location_type", e.target.value)}>
                <option value="">Select</option>
                <option value="home">Home</option>
                <option value="street">Street / informal trading area</option>
                <option value="premises">Own or rented premises</option>
                <option value="mobile">Mobile</option>
                <option value="online">Online only</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Pill selected={form.internet_access === true} onClick={() => set("internet_access", true)}>Have internet access</Pill>
              <Pill selected={form.electricity_access === true} onClick={() => set("electricity_access", true)}>Have electricity access</Pill>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-display font-medium text-navy">What is your biggest challenge right now?</h1>
            <p className="text-sm text-ink-600">Choose as many as apply.</p>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_OPTIONS.map((c) => (
                <Pill key={c.value} selected={form.challenges.includes(c.value)} onClick={() => toggleChallenge(c.value)}>{c.label}</Pill>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-display font-medium text-navy">If Sithelo could help you achieve one thing over the next 12 months, what would it be?</h1>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => (
                <Pill key={g.value} selected={form.goal === g.value} onClick={() => set("goal", g.value)}>{g.label}</Pill>
              ))}
              <Pill selected={form.goal === "custom"} onClick={() => set("goal", "custom")}>Something else</Pill>
            </div>
            {form.goal === "custom" && (
              <input className="input" value={form.goal_custom} onChange={(e) => set("goal_custom", e.target.value)} placeholder="Tell us in your own words" />
            )}
          </div>
        )}

        {error && <p role="alert" aria-live="polite" className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="flex justify-between mt-8">
          <SitheloButton variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </SitheloButton>
          {step < STEPS.length - 1 ? (
            <SitheloButton onClick={() => canAdvance && setStep((s) => s + 1)} disabled={!canAdvance}>
              Next
            </SitheloButton>
          ) : (
            <SitheloButton onClick={handleFinish} disabled={submitting}>
              {submitting ? "Saving…" : "Finish"}
            </SitheloButton>
          )}
        </div>
      </div>
    </div>
  );
}
