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

// Server-side content sniffing: the client-declared MIME type is checked
// as a first pass but never trusted for what actually gets stored — a
// browser only knows what the uploader's OS/UA said. Without this, an
// HTML/JS payload labelled `application/pdf` would pass the allow-list,
// be stored in the private bucket, and later be rendered by a sniffing
// browser from the signed URL (stored-XSS-in-document-pipeline).
function sniffContentType(bytes: Uint8Array): string | null {
  // PDF header: "%PDF-"
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  // JPEG SOI marker: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

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

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // The stored content type and extension come from the BYTES, not from
  // anything the client declared. Reject anything that isn't genuinely
  // PDF/JPEG/PNG — including HTML/JS mislabelled as PDF.
  const sniffedType = sniffContentType(bytes);
  if (!sniffedType || !ALLOWED_MIME_TYPES.has(sniffedType)) {
    return NextResponse.json(
      { error: "The file contents do not match an accepted document type (PDF, JPEG, or PNG)." },
      { status: 400 }
    );
  }
  const storedExtension = sniffedType === "application/pdf" ? "pdf" : sniffedType === "image/png" ? "png" : "jpg";
  const storagePath = `${userId}/${passportId}/${randomUUID()}.${storedExtension}`;

  const { error: uploadErr } = await supabase.storage
    .from("passport-documents")
    .upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: sniffedType,
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
