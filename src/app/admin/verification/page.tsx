import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { refreshPassportScores } from "@/lib/passport/refreshScores";
import { requireAdmin } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloBadge } from "@/components/ui/sithelo";
import { VerificationActions } from "@/components/ui/VerificationActions";
import { ViewDocumentButton } from "@/components/ui/ViewDocumentButton";

// ====================================================================
// DATA SOURCE: public.verifications where status = 'pending', joined to
// business_passports for context. Admin has full SELECT via the
// "verifications: admin manage" RLS policy — real data, no invented
// fields (risk indicators / "outstanding requirements" from the brief
// are NOT rendered, since nothing in the schema computes those; showing
// them would be exactly the fabricated functionality the brief
// prohibits).
//
// Rows are created by the trg_document_requests_verification trigger
// (migration 035) when an entrepreneur uploads a supporting document, so
// each pending verification is shown with the document(s) the decision
// should be based on. Approving marks those documents 'valid' and
// re-checks the passport for publication, both in the database.
//
// ACTIONS: approve/reject call the real admin-verification edge
// function via VerificationActions (client component) — never a direct
// Supabase update from here. The admin's identity is derived from their
// own session token inside the edge function, never sent as a body
// parameter (see docs/security/AUDIT.md for why that distinction is load-bearing).
// ====================================================================

// Mirrors verification_type_for_document() in migration 035.
const VERIFICATION_TYPE_FOR_DOCUMENT: Record<string, string> = {
  cipc_certificate: "cipc",
  tax_clearance: "sars",
  vat_certificate: "vat",
  bbbee_certificate: "bbbee",
  cidb_certificate: "cidb",
  insurance_certificate: "insurance",
  bank_confirmation: "bank",
  municipal_supplier_certificate: "municipal_supplier",
};

interface QueueDocument {
  id: string;
  passport_id: string;
  document_type: string;
  file_name: string;
}


async function reviewRenewalAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const documentId = String(formData.get("document_id"));
  const decision = String(formData.get("decision"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const supabase = await createClient();

  // Both functions re-check is_admin() themselves (migration 037).
  let result = "error=failed";
  if (decision === "accept") {
    const { data: passportId, error } = await supabase.rpc("admin_accept_document_renewal", { p_document_id: documentId });
    // A new expiry date changes the trust score once the old one lapses.
    if (!error && passportId) {
      await refreshPassportScores(passportId as string);
      result = "notice=renewal_accepted";
    }
  } else if (decision === "reject") {
    const { error } = await supabase.rpc("admin_reject_document", { p_document_id: documentId, p_notes: notes });
    if (!error) result = "notice=document_rejected";
  }
  revalidatePath("/admin/verification");
  redirect(`/admin/verification?${result}`);
}

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error: errorKey } = await searchParams;
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("verifications")
    .select("id, passport_id, verification_type, created_at, expiry_date, business_passports(id, business_name, owner_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const passportIds = [...new Set((pending ?? []).map((v) => v.passport_id as string))];
  const { data: documentRows } = passportIds.length
    ? await supabase
        .from("documents")
        .select("id, passport_id, document_type, file_name")
        .in("passport_id", passportIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Renewals: documents still awaiting review whose verification is
  // already verified (migration 035 leaves those verifications alone).
  const { data: waitingDocs } = await supabase
    .from("documents")
    .select("id, passport_id, document_type, file_name, expiry_date, created_at, business_passports(business_name)")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });
  const waitingPassportIds = [...new Set((waitingDocs ?? []).map((d) => d.passport_id as string))];
  const { data: verifiedRows } = waitingPassportIds.length
    ? await supabase
        .from("verifications")
        .select("passport_id, verification_type, expiry_date")
        .eq("status", "verified")
        .in("passport_id", waitingPassportIds)
    : { data: [] };
  const verifiedExpiry = new Map((verifiedRows ?? []).map((v) => [`${v.passport_id}:${v.verification_type}`, v.expiry_date as string | null]));
  const renewals = (waitingDocs ?? []).filter((d) => {
    const type = VERIFICATION_TYPE_FOR_DOCUMENT[d.document_type];
    return type !== undefined && verifiedExpiry.has(`${d.passport_id}:${type}`);
  });

  // Newest first within each "<passport>:<verification type>" bucket.
  const documentsByKey = new Map<string, QueueDocument[]>();
  for (const doc of (documentRows ?? []) as QueueDocument[]) {
    const type = VERIFICATION_TYPE_FOR_DOCUMENT[doc.document_type];
    if (!type) continue;
    const key = `${doc.passport_id}:${type}`;
    documentsByKey.set(key, [...(documentsByKey.get(key) ?? []), doc]);
  }

  return (
    <PortalShell portal="admin" userName={profile.full_name}>
      <div className="mb-10 rule border-b pb-8">
        <div className="eyebrow mb-3">Admin</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">Verification Queue</h1>
        <p className="text-ink-600 mt-2">Open each supporting document, then approve or reject the verification.</p>
      </div>

      <Notice notice={notice} error={errorKey} />
      {error && <p className="text-sm text-ink-600 text-center py-14">We couldn&apos;t load the verification queue right now. Please try again.</p>}

      {!error && (!pending || pending.length === 0) && (
        <SitheloEmptyState title="Nothing pending" body="Every submitted verification has been reviewed. New submissions will appear here." />
      )}

      {!error && pending && pending.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-eyebrow text-ink-500 border-b border-line">
                <th className="pb-3 font-semibold">Business</th>
                <th className="pb-3 font-semibold">Verification type</th>
                <th className="pb-3 font-semibold">Documents</th>
                <th className="pb-3 font-semibold">Expires</th>
                <th className="pb-3 font-semibold">Submitted</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((v) => {
                const bp = Array.isArray(v.business_passports) ? v.business_passports[0] : v.business_passports;
                const docs = documentsByKey.get(`${v.passport_id}:${v.verification_type}`) ?? [];
                return (
                  <tr key={v.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-4 font-medium text-navy">
                      {bp ? <Link href={`/passport/${bp.id}`} className="hover:text-blue-600">{bp.business_name}</Link> : "—"}
                    </td>
                    <td className="py-4 text-ink-600 uppercase text-xs font-semibold tracking-wide">{v.verification_type}</td>
                    <td className="py-4">
                      {docs.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {docs.map((d) => <ViewDocumentButton key={d.id} documentId={d.id} label={d.file_name} />)}
                        </div>
                      ) : (
                        <span className="text-ink-500">No document on file</span>
                      )}
                    </td>
                    <td className="py-4 text-ink-600">{v.expiry_date ? new Date(v.expiry_date).toLocaleDateString("en-ZA") : "—"}</td>
                    <td className="py-4 text-ink-600">{new Date(v.created_at).toLocaleDateString("en-ZA")}</td>
                    <td className="py-4"><SitheloBadge tone="pending">Pending</SitheloBadge></td>
                    <td className="py-4 text-right"><VerificationActions verificationId={v.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rule border-t pt-10 mt-14">
        <h2 className="text-lg font-display font-medium text-navy mb-1">Renewals</h2>
        <p className="text-sm text-ink-600 mb-6">
          New documents for verifications that are still valid. Accepting updates the expiry date; the business stays verified either way.
        </p>
        {renewals.length === 0 ? (
          <p className="text-sm text-ink-500">No renewals waiting.</p>
        ) : (
          <div className="space-y-4">
            {renewals.map((d) => {
              const type = VERIFICATION_TYPE_FOR_DOCUMENT[d.document_type];
              const currentExpiry = verifiedExpiry.get(`${d.passport_id}:${type}`);
              const bp = Array.isArray(d.business_passports) ? d.business_passports[0] : d.business_passports;
              return (
                <div key={d.id} className="card !p-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="text-sm">
                    <Link href={`/passport/${d.passport_id}`} className="font-medium text-navy hover:text-blue-600">{bp?.business_name ?? "Business"}</Link>
                    <span className="text-ink-500 uppercase text-xs font-semibold tracking-wide ml-2">{type}</span>
                    <div className="text-ink-600 mt-1">
                      Current expiry {currentExpiry ? new Date(currentExpiry).toLocaleDateString("en-ZA") : "—"} → new{" "}
                      {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString("en-ZA") : "not given"}
                    </div>
                    <div className="mt-1"><ViewDocumentButton documentId={d.id} label={d.file_name} /></div>
                  </div>
                  <form action={reviewRenewalAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="document_id" value={d.id} />
                    <input type="text" name="notes" placeholder="Reason (sent if rejected)" aria-label="Reason for rejection" className="input !py-1.5 !text-xs w-56" />
                    <SubmitButton name="decision" value="reject" confirm="Reject this renewal document? The business will be notified." pendingLabel="Rejecting…" className="text-xs font-semibold text-red-600 hover:text-red-700">Reject</SubmitButton>
                    <SubmitButton name="decision" value="accept" pendingLabel="Accepting…" className="btn-primary !py-1.5 !px-3 !text-xs">Accept renewal</SubmitButton>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
