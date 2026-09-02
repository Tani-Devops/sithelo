// ====================================================================
// GET /api/documents/[id]/signed-url
//
// The ONLY sanctioned way to read a document from the private
// passport-documents bucket. Storage RLS on that bucket already
// restricts direct access to the owner's own folder + admin (see
// 003_storage_buckets.sql) — there is no storage policy granting
// institutions any access at all, deliberately, because "authorized
// institution context" isn't a simple ownership check; it depends on
// whether that institution has a legitimate reason to see this specific
// business's documents (see the authorization logic below).
//
// Flow: authenticate → load the document + its passport (service role,
// bypassing RLS, because we're about to do our OWN authorization check
// that's stricter and more specific than the base RLS would express) →
// authorize → mint a 60-second signed URL → audit-log the access →
// return it. Never returns a permanent public URL.
// ====================================================================
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_EXPIRY_SECONDS = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const { userId, profile } = await requireAuth();

  const supabase = createServiceClient();

  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_key: `documents-signed-url:${userId}`,
    p_max_requests: 30,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    return NextResponse.json({ error: "Too many document requests. Please try again shortly." }, { status: 429 });
  }

  const { data: document, error: docErr } = await supabase
    .from("documents")
    .select("id, file_path, file_name, document_type, passport_id, business_passports!inner(owner_id)")
    .eq("id", documentId)
    .single();

  if (docErr || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const ownerId = (document as unknown as { business_passports: { owner_id: string } }).business_passports.owner_id;

  const isOwner = ownerId === userId;
  const isAdmin = profile.role === "admin";

  // "Authorized institution context": this institution has an active
  // relationship with the business — a shortlist entry, or an
  // application to one of the institution's opportunities. Being
  // published alone is NOT sufficient (that's the whole point of this
  // route existing — see DATA_CLASSIFICATION.md tier 3).
  //
  // Uses has_passport_relationship() (migration 015) — the single shared
  // primitive also used by get_passport_detail() and
  // list_passport_documents() — rather than running its own inline
  // shortlist/application queries, which is what this route used to do.
  // Three copies of the same relationship check is how they drift apart;
  // there is now exactly one definition of "authorized institution."
  let isAuthorizedInstitution = false;
  if (profile.role === "institution" && profile.institution_id) {
    const { data: hasRelationship } = await supabase.rpc("has_passport_relationship", {
      p_institution_id: profile.institution_id,
      p_passport_id: document.passport_id,
    });
    isAuthorizedInstitution = hasRelationship === true;
  }

  if (!isOwner && !isAdmin && !isAuthorizedInstitution) {
    return NextResponse.json({ error: "Not authorized to access this document" }, { status: 403 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("passport-documents")
    .createSignedUrl(document.file_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signErr || !signed) {
    return NextResponse.json({ error: "Could not generate document access URL" }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "document.accessed",
    entity_type: "document",
    entity_id: documentId,
    metadata: {
      passport_id: document.passport_id,
      access_basis: isOwner ? "owner" : isAdmin ? "admin" : "institution_relationship",
      institution_id: profile.institution_id ?? null,
    },
  });

  return NextResponse.json({
    url: signed.signedUrl,
    file_name: document.file_name,
    expires_in: SIGNED_URL_EXPIRY_SECONDS,
  });
}
