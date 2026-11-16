"use client";

// Submit button for server-action forms: shows a pending label while the
// action runs (so a slow network never looks like a dead click) and can
// ask for confirmation before irreversible decisions.
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingLabel,
  confirm,
  className = "btn-primary",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  /** If set, the browser asks this question first and cancels on "no". */
  confirm?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // With several submit buttons in one form, only the clicked one shows pending.
  const isThisButton = !name || data?.get(name) === value;
  const showPending = pending && isThisButton;

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={showPending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`${className} disabled:opacity-60 disabled:cursor-wait`}
    >
      {showPending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}
