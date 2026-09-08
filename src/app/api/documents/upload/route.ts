// ====================================================================
// POST /api/documents/upload
//
// The ONLY sanctioned way to add a document to the private
// passport-documents bucket + the `documents` table. Mirrors the
// authorization shape of /api/documents/[id]/signed-url: authenticate
// with the session-bound client, then do every real check against the
// service client ourselves rather than leaning on RLS/grants alone —
// this route is the boundary that matters if something upstream has a
// bug (see guards.ts's four-layer model).
//
// Flow: authenticate -> rate limit -> validate inputs -> confirm the
// caller owns the target passport -> upload the file -> insert the
// metadata row -> audit-log -> return the new row.
//
// `status` is never accepted from the client and never included in the
// insert. Migration 005/021 revoke INSERT/UPDATE on `documents.status`
// from `authenticated` at the grant level specifically so a document
// always starts `pending_review` regardless of what a client sends —
// this route honors that same intent even though the service client
// technically bypasses the grant.
// ====================================================================
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // matches passport-documents bucket file_size_limit
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

// Kept in sync with the labels DocumentViewer/passport page display.
// Free-text at the DB level, but constrained here so every document in
// the system is one of a known set the admin verification screen can
// reason about.
const ALLOWED_DOCUMENT_TYPES = new Set([
  "cipc_certificate",
  "tax_clearance",
  "vat_certificate",
  "bbbee_certificate",
  "cidb_certificate",
  "insurance_certificate",
  "bank_confirmation",
  "municipal_supplier_certificate",
  "other",
]);

export async function POST(req: Request) {
  const { userId } = await requireAuth();
  const supabase = createServiceClient();

  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_key: `documents-upload:${userId}`,
    p_max_requests: 20,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    return NextResponse.json({ error: "Too many uploads. Please wait a moment and try again." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const passportId = formData.get("passport_id");
  const documentType = formData.get("document_type");
  const issuedDate = formData.get("issued_date");
  const expiryDate = formData.get("expiry_date");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was provided." }, { status: 400 });
  }
  if (typeof passportId !== "string" || !passportId) {
    return NextResponse.json({ error: "Missing passport_id." }, { status: 400 });
  }
  if (typeof documentType !== "string" || !ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PDF, JPEG, and PNG files are accepted." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File is too large. Maximum size is 10MB." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
  }

  // Ownership check: the caller must own the passport they're uploading
  // to. Institutions/admins never upload here — this route is
  // entrepreneur-only in practice, enforced by ownership rather than
  // role, since that's the check that actually matters.
  const { data: passport, error: passportErr } = await supabase
    .from("business_passports")
    .select("id, owner_id")
    .eq("id", passportId)
    .single();

  if (passportErr || !passport || passport.owner_id !== userId) {
    return NextResponse.json({ error: "Not authorized to upload documents to this passport." }, { status: 403 });
  }

  const rawExtension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const extension = rawExtension || (file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg");
  const storagePath = `${userId}/${passportId}/${randomUUID()}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from("passport-documents")
    .upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: "Could not upload the file. Please try again." }, { status: 500 });
  }

  const { data: document, error: insertErr } = await supabase
    .from("documents")
    .insert({
      passport_id: passportId,
      document_type: documentType,
      file_path: storagePath,
      file_name: file.name,
      issued_date: typeof issuedDate === "string" && issuedDate ? issuedDate : null,
      expiry_date: typeof expiryDate === "string" && expiryDate ? expiryDate : null,
      uploaded_by: userId,
    })
    .select("id, document_type, file_name, status, issued_date, expiry_date, created_at")
    .single();

  if (insertErr || !document) {
    // Compensating cleanup: a file with no metadata row is invisible
    // and harmless (nothing references its path), but a row with no
    // file would be a broken "View" button forever. Prefer the failure
    // mode that's silent over the one that's visibly broken.
    await supabase.storage.from("passport-documents").remove([storagePath]);
    return NextResponse.json({ error: "Could not save the document record. Please try again." }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "document.uploaded",
    entity_type: "document",
    entity_id: document.id,
    metadata: { passport_id: passportId, document_type: documentType },
  });

  return NextResponse.json({ document }, { status: 201 });
}
