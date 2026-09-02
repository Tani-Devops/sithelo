// ====================================================================
// Sithelo component library. Every screen should compose these rather
// than one-off styling — see DESIGN_SYSTEM.md for usage guidance.
// ====================================================================
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

// ---------- Button ----------

interface SitheloButtonProps {
  children: ReactNode;
  variant?: "primary" | "ghost" | "dark";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}

export function SitheloButton({ children, variant = "primary", href, onClick, type = "button", disabled, className = "" }: SitheloButtonProps) {
  const cls = `${variant === "primary" ? "btn-primary" : variant === "dark" ? "btn-dark" : "btn-ghost"} ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

// ---------- Card ----------

export function SitheloCard({ children, className = "", flat = false }: { children: ReactNode; className?: string; flat?: boolean }) {
  return <div className={`${flat ? "card-flat" : "card"} ${className}`}>{children}</div>;
}

// ---------- Badge / status ----------

type StatusTone = "verified" | "pending" | "info" | "neutral" | "rejected";

const STATUS_LABELS: Record<string, string> = {
  verified: "Verified", valid: "Valid", active: "Active", awarded: "Accepted",
  pending: "Pending", pending_review: "Pending review", under_review: "Under review", submitted: "Submitted",
  unverified: "Not verified", expired: "Expired", rejected: "Rejected", withdrawn: "Withdrawn",
  shortlisted: "Shortlisted", draft: "Draft", expiring_soon: "Expiring soon",
};

function toneFor(status: string): StatusTone {
  if (["verified", "valid", "active", "awarded"].includes(status)) return "verified";
  if (["pending", "pending_review", "under_review", "submitted", "shortlisted"].includes(status)) return "pending";
  if (["rejected", "expired", "withdrawn"].includes(status)) return "rejected";
  return "neutral";
}

export function SitheloStatus({ status, label }: { status: string; label?: string }) {
  const tone = toneFor(status);
  const cls = tone === "verified" ? "badge-verified" : tone === "pending" ? "badge-pending" : tone === "rejected" ? "badge bg-red-500/10 text-red-600" : "badge-neutral";
  const dot = tone === "verified" ? "●" : tone === "pending" ? "●" : tone === "rejected" ? "●" : "○";
  return <span className={cls}><span className="text-[8px]">{dot}</span>{label ?? STATUS_LABELS[status] ?? status.replace(/_/g, " ")}</span>;
}

export function SitheloBadge({ children, tone = "info" }: { children: ReactNode; tone?: StatusTone }) {
  const cls = tone === "verified" ? "badge-verified" : tone === "pending" ? "badge-pending" : tone === "info" ? "badge-info" : "badge-neutral";
  return <span className={cls}>{children}</span>;
}

// ---------- Avatar ----------

export function SitheloAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="rounded-full bg-white/15 text-white font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

// ---------- Metric ----------

export function SitheloMetric({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div>
      <div className="text-3xl font-display font-bold text-navy tracking-tight">{value}</div>
      <div className="text-xs text-ink-600 mt-1">{label}</div>
      {sublabel && <div className="text-xs text-teal font-medium mt-0.5">{sublabel}</div>}
    </div>
  );
}

// Progress ring — the signature element: verification %, trust score,
// profile completeness. Sky-to-cobalt gradient stroke on navy.
export function SitheloRing({ value, max = 100, size = 96, label, sublabel }: { value: number; max?: number; size?: number; label?: string; sublabel?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const gradId = `sithelo-ring-${Math.round(value)}-${size}`;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67C7F2" />
            <stop offset="100%" stopColor="#3157D5" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth="7" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#${gradId})`} strokeWidth="7" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-white" style={{ fontSize: size * 0.24 }}>{label ?? value}</span>
        {sublabel && <span className="text-white/60" style={{ fontSize: size * 0.1 }}>{sublabel}</span>}
      </div>
    </div>
  );
}

// ---------- Empty state ----------

export function SitheloEmptyState({ title, body, actionLabel, actionHref }: { title: string; body: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <h3 className="font-display font-semibold text-navy text-lg mb-2">{title}</h3>
      <p className="text-sm text-ink-600 max-w-sm mx-auto mb-5">{body}</p>
      {actionLabel && actionHref && <SitheloButton href={actionHref}>{actionLabel}</SitheloButton>}
    </div>
  );
}

// ---------- Skeleton ----------

export function SitheloSkeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

// ---------- Error state ----------

export function SitheloErrorState({ title = "Something went wrong", body = "Please try again in a moment." }: { title?: string; body?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <h3 className="font-display font-semibold text-navy text-lg mb-2">{title}</h3>
      <p className="text-sm text-ink-600">{body}</p>
    </div>
  );
}

// ---------- Logo ----------

export function SitheloLogo({ height = 40 }: { height?: number }) {
  return (
    <Image
      src="/sithelo-logo.png"
      alt="Sithelo"
      width={height * 2.6}
      height={height}
      style={{ height, width: "auto" }}
      priority
    />
  );
}
