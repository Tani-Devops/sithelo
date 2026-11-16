"use client";

// Opens a private passport document through the sanctioned
// /api/documents/[id]/signed-url route (60-second signed URL, access
// audit-logged). Authorization is decided entirely by that route.
import { useState } from "react";

export function ViewDocumentButton({ documentId, label }: { documentId: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/signed-url`);
      if (!res.ok) {
        setError(res.status === 429 ? "Too many requests. Try again shortly." : "Couldn't open this document.");
        return;
      }
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Couldn't open this document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={open} disabled={loading} className="btn-text !text-xs disabled:opacity-50 text-left">
        {loading ? "Opening…" : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
