// Result banner for server actions. Actions redirect back with
// ?notice=<key> or ?error=<key>; pages pass searchParams here. Only known
// keys render, so a crafted URL can't put arbitrary text on the page.
const MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  applied: { tone: "success", text: "Application submitted. The institution will review it and you'll see its status here." },
  withdrawn: { tone: "success", text: "Your application has been withdrawn." },
  saved: { tone: "success", text: "Your changes have been saved." },
  status_updated: { tone: "success", text: "Application status updated." },
  institution_approved: { tone: "success", text: "Institution approved. They can now publish opportunities." },
  institution_rejected: { tone: "success", text: "Institution rejected. They'll see your note on their dashboard." },
  shortlisted: { tone: "success", text: "Added to your shortlist." },
  unshortlisted: { tone: "success", text: "Removed from your shortlist." },
  renewal_accepted: { tone: "success", text: "Renewal accepted and the expiry date updated." },
  document_rejected: { tone: "success", text: "Document rejected. The business has been notified." },

  already_applied: { tone: "error", text: "You've already applied to this opportunity." },
  not_open: { tone: "error", text: "This opportunity is no longer accepting applications." },
  no_passport: { tone: "error", text: "You need a Business Passport before you can apply." },
  failed: { tone: "error", text: "That didn't work. Please try again, and contact Sithelo if it keeps happening." },
};

export function Notice({ notice, error }: { notice?: string; error?: string }) {
  const message = (error && MESSAGES[error]) || (notice && MESSAGES[notice]);
  if (!message) return null;
  const isError = message.tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`mb-8 border-l-2 pl-4 py-2 text-sm ${isError ? "border-red-600 text-red-700 bg-red-50" : "border-verified text-verified bg-verified/5"}`}
    >
      {message.text}
    </div>
  );
}
