import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SitheloLogo } from "@/components/ui/sithelo";

export default async function NewBusinessPassportPage() {
  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("business_passports")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  // Already onboarded — send to the real Passport, not the wizard again.
  if (existing) redirect("/entrepreneur/dashboard");

  return (
    <main id="main-content" className="min-h-screen bg-soft py-12 px-6">
      <div className="max-w-xl mx-auto mb-8 flex justify-center"><SitheloLogo height={44} /></div>
      <OnboardingWizard />
    </main>
  );
}
