import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";

// ====================================================================
// /entrepreneur/business
//
// Deliberately thin: the real Passport view already exists and is
// security-critical (/passport/[id], backed by get_passport_detail()
// — see migration 015). This route just resolves "my own passport"
// and hands off, rather than re-implementing that view or its RPC
// calls a second time.
// ====================================================================
export default async function MyBusinessPage() {
  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: passport } = await supabase
    .from("business_passports")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!passport) redirect("/entrepreneur/business/new");
  redirect(`/passport/${passport.id}`);
}
