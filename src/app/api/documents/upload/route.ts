// ====================================================================
// POST /api/documents/upload
//
// Step 2 of 2 for adding a passport document (step 1 is
// /api/documents/upload-url, which hands out a signed upload URL for a
// server-chosen path). By the time this runs the bytes are already in
// the private passport-documents bucket; this route decides whether
// they may stay.
//
// Flow: authenticate -> rate limit -> validate inputs -> confirm the
// caller owns the passport AND the path is inside that passport's folder
// -> read the stored object -> check size and sniff the real content
// type -> insert the metadata row -> audit-log. Anything that fails after
// the object exists removes the object, so a rejected file never lingers.
//
// Body: { passport_id, document_type, path, file_name, issued_date?, expiry_date? }
//
// `status` is never accepted from the client and never included in the
// insert, so a document always starts 'pending_review'. The insert fires
// trg_document_requests_verification (migration 035), which opens the
// verification request the admin queue reviews.
// ====================================================================
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rateLimit";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENTS_BUCKET,
  EXTENSION_FOR_TYPE,
  MAX_FILE_SIZE,
  cleanDate,
  isOwnStoragePath,
  isUuid,
  sniffContentType,
} from "@/lib/documents/rules";

export async function POST(req: Request) {
  const { userId } = await requireAuth();
  const supabase = createServiceClient();

  const limitResponse = await enforceRateLimit(
    supabase,
    `documents-upload-complete:${userId}`,
    40,
    3600,
    "Too many uploads. Please wait a moment and try again."
  );
  if (limitResponse) return limitResponse;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const passportId = body.passport_id;
  const documentType = body.document_type;
  const path = body.path;
  const fileName = typeof body.file_name === "string" ? body.file_name.trim().slice(0, 255) : "";

  if (!isUuid(passportId)) {
    return NextResponse.json({ error: "Missing passport_id." }, { status: 400 });
  }
  if (typeof documentType !== "string" || !ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  // Checked before anything touches storage: a caller can only ever
  // claim (or cause the removal of) an object in their own folder.
  if (!isOwnStoragePath(path, userId, passportId)) {
    return NextResponse.json({ error: "Invalid upload reference." }, { status: 400 });
  }

  const { data: passport } = await supabase
    .from("business_passports")
    .select("owner_id")
    .eq("id", passportId)
    .maybeSingle();
  if (!passport || passport.owner_id !== userId) {
    return NextResponse.json({ error: "Not authorized to upload documents to this passport." }, { status: 403 });
  }

  const { data: existing } = await supabase.from("documents").select("id").eq("file_path", path).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "This upload has already been saved." }, { status: 409 });
  }

  const discard = async (message: string, status: number) => {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return NextResponse.json({ error: message }, { status });
  };

  const { data: blob, error: downloadErr } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path);
  if (downloadErr || !blob) {
    return NextResponse.json({ error: "We couldn't find the uploaded file. Please try again." }, { status: 400 });
  }
  if (blob.size === 0) return discard("The selected file is empty.", 400);
  if (blob.size > MAX_FILE_SIZE) return discard("File is too large. Maximum size is 10MB.", 400);

  const sniffedType = sniffContentType(new Uint8Array(await blob.slice(0, 8).arrayBuffer()));
  if (!sniffedType || !path.toLowerCase().endsWith(`.${EXTENSION_FOR_TYPE[sniffedType]}`)) {
    return discard("The file contents do not match an accepted document type (PDF, JPEG, or PNG).", 400);
  }

  const { data: document, error: insertErr } = await supabase
    .from("documents")
    .insert({
      passport_id: passportId,
      document_type: documentType,
      file_path: path,
      file_name: fileName || `document.${EXTENSION_FOR_TYPE[sniffedType]}`,
      issued_date: cleanDate(body.issued_date),
      expiry_date: cleanDate(body.expiry_date),
      uploaded_by: userId,
    })
    .select("id, document_type, file_name, status, issued_date, expiry_date, created_at")
    .single();

  if (insertErr || !document) {
    return discard("Could not save the document record. Please try again.", 500);
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
