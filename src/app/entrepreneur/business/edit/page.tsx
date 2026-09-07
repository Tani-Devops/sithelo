import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { SitheloButton, SitheloLogo } from "@/components/ui/sithelo";

// ====================================================================
// /entrepreneur/business/edit
//
// The update payload only ever includes columns actually granted to
// `authenticated` in migration 021's UPDATE grant — trust_score,
// readiness_score, profile_completeness, overall_verification_status,
// is_published, owner_id and passport_code are excluded from that
// grant at the database level, so even if this form tried to send
// them, Postgres would reject it. This form doesn't try.
//
// Prefill comes from get_passport_detail() (owner tier), since several
// of these columns (business_email, business_phone, head_office_address,
// key_clients, annual_turnover) are excluded from the plain SELECT
// grant entirely — see migration 021/015. registration_number isn't
// returned by that RPC at all (a pre-existing gap, not something this
// pass changes) so it's edit-only here, not prefilled.
// ====================================================================

interface PassportDetail {
  id: string;
  business_name: string;
  business_type: string | null;
  established_year: number | null;
  industry: string | null;
  sub_industry: string | null;
  province: string | null;
  municipality: string | null;
  business_description: string | null;
  core_services: string | null;
  equipment_owned: string | null;
  capacity_range: string | null;
  employees_count: number | null;
  years_trading: number | null;
  website: string | null;
  business_email?: string | null;
  business_phone?: string | null;
  head_office_address?: string | null;
  key_clients?: string | null;
  annual_turnover?: number | null;
}

interface Capability {
  id: string;
  capability_type: string;
  name: string;
  description: string | null;
  capacity: string | null;
  verified: boolean;
}

interface Asset {
  id: string;
  asset_type: string;
  name: string;
  quantity: number | null;
  condition: string | null;
}

function clean(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

async function updatePassportAction(formData: FormData) {
  "use server";
  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();
  const passportId = String(formData.get("passport_id"));

  // Explicit column list, matching exactly what migration 021 grants
  // `authenticated` on UPDATE — nothing scored/verification-related is
  // in this object, on purpose.
  await supabase
    .from("business_passports")
    .update({
      business_name: clean(formData.get("business_name")),
      registration_number: clean(formData.get("registration_number")),
      business_type: clean(formData.get("business_type")),
      industry: clean(formData.get("industry")),
      sub_industry: clean(formData.get("sub_industry")),
      province: clean(formData.get("province")),
      municipality: clean(formData.get("municipality")),
      head_office_address: clean(formData.get("head_office_address")),
      business_description: clean(formData.get("business_description")),
      core_services: clean(formData.get("core_services")),
      equipment_owned: clean(formData.get("equipment_owned")),
      capacity_range: clean(formData.get("capacity_range")),
      employees_count: formData.get("employees_count") ? Number(formData.get("employees_count")) : null,
      years_trading: formData.get("years_trading") ? Number(formData.get("years_trading")) : null,
      website: clean(formData.get("website")),
      business_email: clean(formData.get("business_email")),
      business_phone: clean(formData.get("business_phone")),
    })
    .eq("id", passportId)
    .eq("owner_id", userId); // belt-and-braces; RLS ("passports: owner full access") is the real authority

  revalidatePath(`/passport/${passportId}`);
  redirect(`/passport/${passportId}`);
}

async function addCapabilityAction(formData: FormData) {
  "use server";
  await requireEntrepreneur();
  const supabase = await createClient();
  const passportId = String(formData.get("passport_id"));
  const name = clean(formData.get("name"));
  if (!name) return;

  // `verified` is not in this insert — migration 025 only grants
  // authenticated INSERT on (passport_id, capability_type, name,
  // description, capacity); `verified` stays false until an admin/
  // backend process sets it.
  await supabase.from("business_capabilities").insert({
    passport_id: passportId,
    capability_type: clean(formData.get("capability_type")) ?? "general",
    name,
    description: clean(formData.get("description")),
    capacity: clean(formData.get("capacity")),
  });
  revalidatePath("/entrepreneur/business/edit");
}

async function deleteCapabilityAction(formData: FormData) {
  "use server";
  await requireEntrepreneur();
  const supabase = await createClient();
  await supabase.from("business_capabilities").delete().eq("id", String(formData.get("capability_id")));
  revalidatePath("/entrepreneur/business/edit");
}

async function addAssetAction(formData: FormData) {
  "use server";
  await requireEntrepreneur();
  const supabase = await createClient();
  const passportId = String(formData.get("passport_id"));
  const name = clean(formData.get("name"));
  if (!name) return;

  await supabase.from("business_assets").insert({
    passport_id: passportId,
    asset_type: clean(formData.get("asset_type")) ?? "general",
    name,
    quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
    condition: clean(formData.get("condition")),
  });
  revalidatePath("/entrepreneur/business/edit");
}

async function deleteAssetAction(formData: FormData) {
  "use server";
  await requireEntrepreneur();
  const supabase = await createClient();
  await supabase.from("business_assets").delete().eq("id", String(formData.get("asset_id")));
  revalidatePath("/entrepreneur/business/edit");
}

export default async function EditBusinessPassportPage() {
  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: passportRow } = await supabase
    .from("business_passports")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!passportRow) redirect("/entrepreneur/business/new");

  const { data: detailRaw } = await supabase.rpc("get_passport_detail", { p_passport_id: passportRow.id });
  const detail = detailRaw as unknown as PassportDetail;

  const { data: capabilities } = await supabase
    .from("business_capabilities")
    .select("id, capability_type, name, description, capacity, verified")
    .eq("passport_id", passportRow.id)
    .order("created_at", { ascending: false });

  const { data: assets } = await supabase
    .from("business_assets")
    .select("id, asset_type, name, quantity, condition")
    .eq("passport_id", passportRow.id)
    .order("created_at", { ascending: false });

  return (
    <main id="main-content" className="min-h-screen bg-ivory px-6 py-10 max-w-3xl mx-auto">
      <div className="mb-8"><SitheloLogo height={32} /></div>
      <div className="eyebrow mb-3">Business Passport</div>
      <h1 className="text-display-lg font-display font-medium text-navy leading-tight mb-10">Edit your Business Passport</h1>

      <form action={updatePassportAction} className="space-y-5 rule border-t pt-8 mb-12">
        <input type="hidden" name="passport_id" value={detail.id} />
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Business name" name="business_name" defaultValue={detail.business_name} />
          <Field label="Registration number (optional)" name="registration_number" />
          <div>
            <label htmlFor="business_type" className="block text-sm font-medium text-navy mb-1.5">Business type</label>
            <select id="business_type" name="business_type" defaultValue={detail.business_type ?? ""} className="input">
              <option value="">Not yet registered</option>
              <option value="sole_proprietor">Sole proprietor</option>
              <option value="private_company">Private company (Pty Ltd)</option>
              <option value="close_corporation">Close corporation</option>
              <option value="partnership">Partnership</option>
              <option value="npo">NPO</option>
              <option value="cooperative">Cooperative</option>
            </select>
          </div>
          <Field label="Industry" name="industry" defaultValue={detail.industry ?? ""} />
          <Field label="Sub-industry" name="sub_industry" defaultValue={detail.sub_industry ?? ""} />
          <Field label="Province" name="province" defaultValue={detail.province ?? ""} />
          <Field label="Municipality" name="municipality" defaultValue={detail.municipality ?? ""} />
          <Field label="Head office address" name="head_office_address" defaultValue={detail.head_office_address ?? ""} />
          <Field label="Employees" name="employees_count" type="number" defaultValue={detail.employees_count?.toString() ?? ""} />
          <Field label="Years trading" name="years_trading" type="number" defaultValue={detail.years_trading?.toString() ?? ""} />
          <Field label="Capacity range" name="capacity_range" defaultValue={detail.capacity_range ?? ""} />
          <Field label="Website" name="website" defaultValue={detail.website ?? ""} />
          <Field label="Business email" name="business_email" defaultValue={detail.business_email ?? ""} />
          <Field label="Business phone" name="business_phone" defaultValue={detail.business_phone ?? ""} />
        </div>
        <TextArea label="Description" name="business_description" defaultValue={detail.business_description ?? ""} />
        <TextArea label="Core services" name="core_services" defaultValue={detail.core_services ?? ""} />
        <TextArea label="Equipment owned" name="equipment_owned" defaultValue={detail.equipment_owned ?? ""} />
        <SitheloButton type="submit">Save changes</SitheloButton>
      </form>

      <div className="rule border-t pt-8 mb-12">
        <h2 className="eyebrow mb-5">Capabilities</h2>
        <div className="mb-6">
          {(capabilities as Capability[] | null)?.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-3 border-b border-line text-sm">
              <div>
                <span className="font-medium text-navy">{c.name}</span>
                <span className="text-ink-600"> · {c.capability_type}{c.capacity ? ` · ${c.capacity}` : ""}</span>
                {c.verified && <span className="text-verified ml-2">✓ verified</span>}
              </div>
              <form action={deleteCapabilityAction}>
                <input type="hidden" name="capability_id" value={c.id} />
                <button type="submit" className="text-red-600 text-xs" aria-label={`Remove ${c.name}`}>Remove</button>
              </form>
            </div>
          ))}
          {(!capabilities || capabilities.length === 0) && <p className="text-sm text-ink-600">No capabilities added yet.</p>}
        </div>
        <form action={addCapabilityAction} className="grid sm:grid-cols-2 gap-3">
          <input type="hidden" name="passport_id" value={detail.id} />
          <label htmlFor="cap_name" className="sr-only">Capability name</label>
          <input id="cap_name" name="name" placeholder="e.g. Bulk catering" className="input" required />
          <label htmlFor="cap_type" className="sr-only">Capability type</label>
          <input id="cap_type" name="capability_type" placeholder="Type e.g. service" className="input" />
          <label htmlFor="cap_capacity" className="sr-only">Capacity</label>
          <input id="cap_capacity" name="capacity" placeholder="Capacity e.g. 200 meals/day" className="input" />
          <label htmlFor="cap_description" className="sr-only">Description</label>
          <input id="cap_description" name="description" placeholder="Description (optional)" className="input" />
          <div className="sm:col-span-2"><SitheloButton type="submit" variant="ghost">Add capability</SitheloButton></div>
        </form>
      </div>

      <div className="rule border-t pt-8">
        <h2 className="eyebrow mb-5">Assets</h2>
        <div className="mb-6">
          {(assets as Asset[] | null)?.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-3 border-b border-line text-sm">
              <div>
                <span className="font-medium text-navy">{a.name}</span>
                <span className="text-ink-600"> · {a.asset_type}{a.quantity ? ` · x${a.quantity}` : ""}{a.condition ? ` · ${a.condition}` : ""}</span>
              </div>
              <form action={deleteAssetAction}>
                <input type="hidden" name="asset_id" value={a.id} />
                <button type="submit" className="text-red-600 text-xs" aria-label={`Remove ${a.name}`}>Remove</button>
              </form>
            </div>
          ))}
          {(!assets || assets.length === 0) && <p className="text-sm text-ink-600">No assets added yet.</p>}
        </div>
        <form action={addAssetAction} className="grid sm:grid-cols-2 gap-3">
          <input type="hidden" name="passport_id" value={detail.id} />
          <label htmlFor="asset_name" className="sr-only">Asset name</label>
          <input id="asset_name" name="name" placeholder="e.g. Delivery van" className="input" required />
          <label htmlFor="asset_type" className="sr-only">Asset type</label>
          <input id="asset_type" name="asset_type" placeholder="Type e.g. vehicle" className="input" />
          <label htmlFor="asset_quantity" className="sr-only">Quantity</label>
          <input id="asset_quantity" name="quantity" type="number" placeholder="Quantity" className="input" />
          <label htmlFor="asset_condition" className="sr-only">Condition</label>
          <input id="asset_condition" name="condition" placeholder="Condition e.g. good" className="input" />
          <div className="sm:col-span-2"><SitheloButton type="submit" variant="ghost">Add asset</SitheloButton></div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, name, type = "text", defaultValue }: { label: string; name: string; type?: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-navy mb-1.5">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} className="input" />
    </div>
  );
}

function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-navy mb-1.5">{label}</label>
      <textarea id={name} name={name} defaultValue={defaultValue} rows={3} className="input" />
    </div>
  );
}
