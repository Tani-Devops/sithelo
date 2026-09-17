"use client";

// ====================================================================
// /institution/onboarding
//
// requireInstitution() (src/lib/auth/guards.ts) has always redirected
// an institution-role account with no institution_id here. This page
// collects only what's genuinely needed to stand up the institution
// record, then calls POST /api/institution/onboarding, which writes
// everything atomically via complete_institution_onboarding() (migration
// 027) and links this account to the new institution in the same
// transaction. See that migration for why this is a brand-new
// institution every time, never a join to an existing one -- letting a
// user attach themselves to an arbitrary institution_id was a real,
// already-fixed vulnerability (migration 005).
// ====================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SitheloLogo, SitheloButton } from "@/components/ui/sithelo";

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

const INSTITUTION_TYPES = [
  { value: "municipality", label: "Municipality" },
  { value: "dfi", label: "Development finance institution" },
  { value: "sez", label: "Special economic zone" },
  { value: "corporate", label: "Corporate / enterprise development" },
  { value: "ngo", label: "NGO / non-profit" },
  { value: "government", label: "Government department / agency" },
  { value: "other", label: "Other" },
];

export default function InstitutionOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    institution_type: "",
    province: "",
    municipality: "",
    website: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    description: "",
    focus_area: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Please enter your organisation's name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
      setError("Please enter a valid primary contact email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/institution/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push("/institution/dashboard");
      router.refresh();
    } catch {
      setError("We couldn't reach Sithelo. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-soft px-6 py-12">
      <div className="card w-full max-w-xl">
        <div className="mb-6 flex justify-center"><SitheloLogo height={40} /></div>
        <h1 className="text-2xl font-display font-medium text-navy mb-1.5 text-center">Set up your institution</h1>
        <p className="text-sm text-ink-600 mb-8 text-center">
          Tell us about your organisation so verified entrepreneurs and opportunities can find each other.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-navy mb-1.5">Organisation name</label>
            <input id="name" className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. eThekwini Enterprise Development Agency" />
          </div>

          <div>
            <label htmlFor="institution_type" className="block text-sm font-medium text-navy mb-1.5">Organisation type</label>
            <select id="institution_type" className="input" value={form.institution_type} onChange={(e) => set("institution_type", e.target.value)}>
              <option value="">Select type</option>
              {INSTITUTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="province" className="block text-sm font-medium text-navy mb-1.5">Province</label>
              <select id="province" className="input" value={form.province} onChange={(e) => set("province", e.target.value)}>
                <option value="">Select province</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="municipality" className="block text-sm font-medium text-navy mb-1.5">Municipality / city</label>
              <input id="municipality" className="input" value={form.municipality} onChange={(e) => set("municipality", e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="website" className="block text-sm font-medium text-navy mb-1.5">Website (if applicable)</label>
            <input id="website" type="url" className="input" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="contact_name" className="block text-sm font-medium text-navy mb-1.5">Primary contact name</label>
              <input id="contact_name" className="input" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </div>
            <div>
              <label htmlFor="contact_email" className="block text-sm font-medium text-navy mb-1.5">Primary contact email</label>
              <input id="contact_email" type="email" required className="input" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="contact_phone" className="block text-sm font-medium text-navy mb-1.5">Contact phone (if applicable)</label>
            <input id="contact_phone" type="tel" className="input" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-navy mb-1.5">Short description of your institution</label>
            <textarea id="description" rows={3} className="input" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div>
            <label htmlFor="focus_area" className="block text-sm font-medium text-navy mb-1.5">Procurement / opportunity focus (if relevant)</label>
            <input id="focus_area" className="input" value={form.focus_area} onChange={(e) => set("focus_area", e.target.value)} placeholder="e.g. construction, catering, ICT services" />
          </div>

          {error && <p role="alert" aria-live="polite" className="text-sm text-red-600">{error}</p>}

          <SitheloButton type="submit" disabled={loading} className="w-full justify-center">
            {loading ? "Setting up your account…" : "Complete setup"}
          </SitheloButton>
        </form>
      </div>
    </main>
  );
}
