"use client";

// ====================================================================
// DocumentViewer — the first real UI consumer of both
// list_passport_documents() (migration 012) and
// /api/documents/[id]/signed-url (Part 4, prior pass). Now also the
// consumer of /api/documents/upload for the passport owner.
//
// Authorization happens entirely server-side (the RPC and both route
// handlers re-check independently) — this component has no local
// notion of "am I allowed to see or add this," it just renders what
// the server gave it and handles 403/404/429 cleanly. That's
// deliberate: a client-side permission check here would be UX polish at
// best and a false sense of security at worst. `canUpload` below is
// exactly that kind of UX polish — hiding the form for non-owners saves
// a wasted round trip, but the actual gate is the 403 the upload route
// returns to anyone who isn't the passport's owner.
// ====================================================================
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { SitheloStatus, SitheloButton } from "@/components/ui/sithelo";

interface DocumentMeta {
  id: string;
  document_type: string;
  file_name: string;
  status: "valid" | "expiring_soon" | "expired" | "pending_review";
  issued_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

type LoadState = "loading" | "empty" | "denied" | "not_found" | "error" | "ready";

// Kept in sync with the ALLOWED_DOCUMENT_TYPES allow-list in
// /api/documents/upload — this is the human-facing half of that list.
const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "cipc_certificate", label: "CIPC registration certificate" },
  { value: "tax_clearance", label: "SARS tax clearance" },
  { value: "vat_certificate", label: "VAT registration certificate" },
  { value: "bbbee_certificate", label: "B-BBEE certificate" },
  { value: "cidb_certificate", label: "CIDB registration" },
  { value: "insurance_certificate", label: "Insurance certificate" },
  { value: "bank_confirmation", label: "Bank confirmation letter" },
  { value: "municipal_supplier_certificate", label: "Municipal supplier certificate" },
  { value: "other", label: "Other" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function DocumentViewer({ passportId, canUpload = false }: { passportId: string; canUpload?: boolean }) {
  const [state, setState] = useState<LoadState>("loading");
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPE_OPTIONS[0].value);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  async function load() {
    setState("loading");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_passport_documents", { p_passport_id: passportId });

    if (error) {
      // The RPC raises a plain exception (not a typed error code) for
      // both "not found" and "not authorized" — Postgres surfaces both
      // as a generic error here, so we can't reliably distinguish them
      // client-side. That's fine: the honest, safe behavior is to show
      // the same "can't access this" state either way, rather than
      // leaking which case it was (confirming a passport ID exists to
      // someone who isn't authorized to see it is itself a small
      // information leak).
      setState(error.message.toLowerCase().includes("not found") ? "not_found" : "denied");
      return;
    }

    setDocuments((data as DocumentMeta[]) ?? []);
    setState(((data as DocumentMeta[]) ?? []).length === 0 ? "empty" : "ready");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  function resetUploadForm() {
    setDocumentType(DOCUMENT_TYPE_OPTIONS[0].value);
    setSelectedFile(null);
    setIssuedDate("");
    setExpiryDate("");
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!selectedFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(selectedFile.type)) {
      setUploadError("Only PDF, JPEG, and PNG files are accepted.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError("File is too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUploadError("Your session has expired. Please log in again.");
        return;
      }

      const body = new FormData();
      body.append("file", selectedFile);
      body.append("passport_id", passportId);
      body.append("document_type", documentType);
      if (issuedDate) body.append("issued_date", issuedDate);
      if (expiryDate) body.append("expiry_date", expiryDate);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setUploadError(payload?.error ?? "Something went wrong uploading this document.");
        return;
      }

      setUploadSuccess("Document uploaded — pending admin review.");
      resetUploadForm();
      setShowUploadForm(false);
      await load();
    } catch {
      setUploadError("Something went wrong uploading this document.");
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(doc: DocumentMeta) {
    setOpeningId(doc.id);
    setOpenError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setOpenError("Your session has expired. Please log in again.");
        return;
      }

      const res = await fetch(`/api/documents/${doc.id}/signed-url`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 403) {
        setOpenError("You're not authorized to access this document.");
        return;
      }
      if (res.status === 404) {
        setOpenError("This document could not be found.");
        return;
      }
      if (res.status === 429) {
        setOpenError("Too many document requests. Please wait a moment and try again.");
        return;
      }
      if (!res.ok) {
        setOpenError("Something went wrong opening this document.");
        return;
      }

      const { url } = await res.json();
      // Opens in a new tab; the signed URL expires in 60 seconds, so
      // there's no persistent link left sitting in browser history that
      // still works later.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setOpenError("Something went wrong opening this document.");
    } finally {
      setOpeningId(null);
    }
  }

  if (state === "loading") {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-line/50 rounded w-1/3" />
          <div className="h-4 bg-line/50 rounded w-1/2" />
          <div className="h-4 bg-line/50 rounded w-1/4" />
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-600">
          You don&apos;t have access to this business&apos;s documents. Institutions unlock document access once a
          business has been shortlisted or has applied to one of your opportunities.
        </p>
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-600">This business passport could not be found.</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-600">Something went wrong loading documents. Please try again.</p>
      </div>
    );
  }

  const uploadForm = showUploadForm && (
    <form onSubmit={handleUpload} className="border-t border-line mt-4 pt-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-ink-500 block mb-1">Document type</span>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="input text-sm w-full"
          >
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-500 block mb-1">File (PDF, JPEG, or PNG · max 10MB)</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="text-sm w-full"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-500 block mb-1">Issued date (optional)</span>
          <input
            type="date"
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.target.value)}
            className="input text-sm w-full"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-500 block mb-1">Expiry date (optional)</span>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="input text-sm w-full"
          />
        </label>
      </div>
      {uploadError && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">{uploadError}</p>
      )}
      <div className="flex items-center gap-3">
        <SitheloButton type="submit" disabled={uploading} className="!px-4 !py-2 text-xs">
          {uploading ? "Uploading…" : "Upload document"}
        </SitheloButton>
        <button
          type="button"
          onClick={() => { setShowUploadForm(false); setUploadError(null); resetUploadForm(); }}
          className="text-xs text-ink-600 hover:text-navy"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-ink-500">
        New documents start as pending review — an admin verifies each one before it counts toward your trust score.
      </p>
    </form>
  );

  const uploadToggle = canUpload && !showUploadForm && (
    <button
      type="button"
      onClick={() => { setShowUploadForm(true); setUploadSuccess(null); }}
      className="btn-ghost text-xs px-3 py-1.5"
    >
      Upload document
    </button>
  );

  if (state === "empty") {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-600 mb-4">No documents uploaded yet.</p>
        {canUpload && (
          <div className="max-w-sm mx-auto text-left">
            <div className="flex justify-center mb-2">{uploadToggle}</div>
            {uploadForm}
            {uploadSuccess && <p className="text-sm text-teal text-center mt-3">{uploadSuccess}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Documents &amp; Certificates</h2>
        {uploadToggle}
      </div>
      {uploadForm}
      {uploadSuccess && <p className="text-sm text-teal mt-3">{uploadSuccess}</p>}
      <div className="space-y-2 mt-4">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between border-b border-line last:border-0 py-3">
            <div>
              <div className="text-sm font-medium">{doc.file_name}</div>
              <div className="text-xs text-ink-600 mt-0.5">
                {doc.document_type.replace(/_/g, " ")}
                {doc.expiry_date && ` · Expires ${new Date(doc.expiry_date).toLocaleDateString("en-ZA")}`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SitheloStatus status={doc.status} />
              <button
                type="button"
                onClick={() => openDocument(doc)}
                disabled={openingId === doc.id}
                aria-label={`View ${doc.file_name}`}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50"
              >
                {openingId === doc.id ? "Opening…" : "View"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {openError && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600 mt-3">
          {openError}
        </p>
      )}
    </div>
  );
}
