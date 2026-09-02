"use client";

// ====================================================================
// DocumentViewer — the first real UI consumer of both
// list_passport_documents() (migration 012) and
// /api/documents/[id]/signed-url (Part 4, prior pass).
//
// Authorization happens entirely server-side (the RPC and the route
// handler both re-check independently) — this component has no local
// notion of "am I allowed to see this," it just renders what the server
// gave it and handles the 403/404 the server sends back cleanly. That's
// deliberate: a client-side permission check here would be UX polish at
// best and a false sense of security at worst.
// ====================================================================
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SitheloStatus } from "@/components/ui/sithelo";

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

export function DocumentViewer({ passportId }: { passportId: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      const supabase = createClient();
      const { data, error } = await supabase.rpc("list_passport_documents", { p_passport_id: passportId });

      if (cancelled) return;

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

    load();
    return () => {
      cancelled = true;
    };
  }, [passportId]);

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

  if (state === "empty") {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-600">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-sm font-semibold mb-4">Documents &amp; Certificates</h2>
      <div className="space-y-2">
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
                onClick={() => openDocument(doc)}
                disabled={openingId === doc.id}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50"
              >
                {openingId === doc.id ? "Opening…" : "View"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {openError && <p className="text-sm text-red-600 mt-3">{openError}</p>}
    </div>
  );
}
