"use client";

// ====================================================================
// Calls the real admin-verification edge function via
// supabase.functions.invoke(), which automatically attaches the
// current session's Authorization header — the admin's identity is
// derived server-side from that token inside the edge function itself,
// never sent as a body parameter. No direct Supabase table update from
// here, by design (see AUDIT.md / SECURITY_AUDIT_MASTER.md on why
// admin_id-in-body was a real, previously-exploitable bug in an earlier
// version of this exact function).
// ====================================================================
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function VerificationActions({ verificationId }: { verificationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setLoading(decision);
    setError(null);
    const supabase = createClient();
    const { error: invokeError } = await supabase.functions.invoke("admin-verification", {
      body: { verification_id: verificationId, decision },
    });
    if (invokeError) {
      setError("Couldn't record that decision. Please try again.");
      setLoading(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2 items-center">
      {error && <span className="text-xs text-red-600 mr-2">{error}</span>}
      <button
        onClick={() => decide("reject")}
        disabled={loading !== null}
        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {loading === "reject" ? "Rejecting…" : "Reject"}
      </button>
      <button
        onClick={() => decide("approve")}
        disabled={loading !== null}
        className="btn-primary !py-1.5 !px-3 !text-xs disabled:opacity-50"
      >
        {loading === "approve" ? "Approving…" : "Approve"}
      </button>
    </div>
  );
}
