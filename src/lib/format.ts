// Display formatting shared across portal pages.

/**
 * Compact rand amounts: R850, R45k, R1.2M, R3.4bn. The previous inline
 * formatting divided everything by a million, so R100 000 showed as "R0.1M".
 */
export function formatRand(value: number | string | null | undefined): string {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ""));
  if (abs >= 1e9) return `R${trim(n / 1e9)}bn`;
  if (abs >= 1e6) return `R${trim(n / 1e6)}M`;
  if (abs >= 1e3) return `R${trim(n / 1e3)}k`;
  return `R${Math.round(n)}`;
}

/** "under_review" -> "Under review" */
export function humanize(value: string): string {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 16 Nov 2026 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}
