// ====================================================================
// POST /api/documents/upload-url
//
// Step 1 of 2 for adding a passport document. The file itself never
// passes through this app (Vercel caps function request bodies at about
// 4.5 MB, below the 10 MB the bucket allows). Instead the caller gets a
// signed upload URL for ONE server-chosen path inside their own
// passport's folder, uploads the bytes straight to Supabase Storage, then
// calls POST /api/documents/upload to have the stored file checked and
// recorded.
//
// Body: { passport_id, document_type, content_type, size }
// Returns: { path, token }
// ====================================================================
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rateLimit";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENTS_BUCKET,
  EXTENSION_FOR_TYPE,
  MAX_FILE_SIZE,
  isUuid,
} from "@/lib/documents/rules";

export async function POST(req: Request) {
  const { userId } = await requireAuth();
  const supabase = createServiceClient();

  const limitResponse = await enforceRateLimit(
    supabase,
    `documents-upload:${userId}`,
    20,
    3600,
    "Too many uploads. Please wait a moment and try again."
  );
  if (limitResponse) return limitResponse;

  let body: { passport_id?: unknown; document_type?: unknown; content_type?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { passport_id: passportId, document_type: documentType, content_type: contentType, size } = body;

  if (!isUuid(passportId)) {
    return NextResponse.json({ error: "Missing passport_id." }, { status: 400 });
  }
  if (typeof documentType !== "string" || !ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  if (typeof contentType !== "string" || !EXTENSION_FOR_TYPE[contentType]) {
    return NextResponse.json({ error: "Only PDF, JPEG, and PNG files are accepted." }, { status: 400 });
  }
  if (typeof size !== "number" || size <= 0) {
    return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
  }
  if (size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File is too large. Maximum size is 10MB." }, { status: 400 });
  }

  const { data: passport } = await supabase
    .from("business_passports")
    .select("owner_id")
    .eq("id", passportId)
    .maybeSingle();
  if (!passport || passport.owner_id !== userId) {
    return NextResponse.json({ error: "Not authorized to upload documents to this passport." }, { status: 403 });
  }

  const path = `${userId}/${passportId}/${randomUUID()}.${EXTENSION_FOR_TYPE[contentType]}`;
  const { data: signed, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path);
  if (error || !signed) {
    return NextResponse.json({ error: "Could not prepare the upload. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ path: signed.path, token: signed.token });
}
