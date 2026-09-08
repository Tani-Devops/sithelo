"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // middleware.ts sends any unauthenticated request past a protected
    // route straight to /login, so a hard refresh after redirect is
    // enough — no need to clear local state manually.
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        variant === "dark"
          ? "text-xs font-medium text-white/60 hover:text-white transition-colors disabled:opacity-50"
          : "text-xs font-medium text-ink-500 hover:text-navy transition-colors disabled:opacity-50"
      }
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
