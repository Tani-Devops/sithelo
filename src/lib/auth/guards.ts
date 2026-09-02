// ====================================================================
// Centralized authorization utilities for Server Components and Route
// Handlers. Every protected page/route should call one of these instead
// of hand-rolling its own `if (!user) redirect(...)` — see AUDIT.md for
// why duplicated authorization logic is itself a security risk (it's
// easy to get right nine times and wrong once).
//
// These are Layer 2 of the four-layer model documented in
// SYSTEM_ARCHITECTURE.md:
//   Layer 1: middleware.ts       — coarse authenticated/public routing
//   Layer 2: these functions     — role-correct routing + data fetch
//   Layer 3: Postgres RLS        — the actual authorization ground truth
//   Layer 4: edge function guards (_shared/auth.ts) — same pattern, Deno side
//
// None of these layers is sufficient alone. Layer 1 stops obviously
// unauthenticated access early (good UX, not itself security). Layer 2
// stops a logged-in entrepreneur from rendering the admin dashboard.
// Layer 3 is what actually stops a crafted request that skips the UI
// entirely — it's the layer that matters if the other three have a bug.
// ====================================================================
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export async function requireAuth(): Promise<{ userId: string; profile: Profile }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  return { userId: user.id, profile: profile as unknown as Profile };
}

export async function requireRole(allowed: UserRole[]): Promise<{ userId: string; profile: Profile }> {
  const { userId, profile } = await requireAuth();
  if (!allowed.includes(profile.role)) {
    // Deliberately redirect to that role's own dashboard rather than a
    // generic 403 page — an entrepreneur hitting /admin/dashboard should
    // land somewhere useful, not a dead end, while still never rendering
    // admin data.
    redirect(dashboardPathForRole(profile.role));
  }
  return { userId, profile };
}

export async function requireEntrepreneur() {
  return requireRole(["entrepreneur"]);
}

export async function requireInstitution() {
  const result = await requireRole(["institution", "admin"]);
  if (result.profile.role === "institution" && !result.profile.institution_id) {
    redirect("/institution/onboarding");
  }
  return result;
}

export async function requireAdmin() {
  return requireRole(["admin"]);
}

export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "admin": return "/admin/dashboard";
    case "institution": return "/institution/dashboard";
    default: return "/entrepreneur/dashboard";
  }
}
