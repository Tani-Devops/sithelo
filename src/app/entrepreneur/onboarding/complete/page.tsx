import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { SitheloButton, SitheloLogo } from "@/components/ui/sithelo";

// ====================================================================
// /entrepreneur/onboarding/complete — the "WE SEE YOU" screen (§39).
//
// Reads the persona that /api/onboarding/complete already computed
// and persisted in the same request as the wizard submission — this
// page never computes anything itself, only reflects real stored data
// back. If a persona genuinely isn't there yet (e.g. this URL was hit
// directly), it says so honestly rather than fabricating one.
// ====================================================================

export default async function OnboardingCompletePage() {
  const { userId, profile } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: entrepreneurProfile } = await supabase
    .from("entrepreneur_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: persona } = entrepreneurProfile
    ? await supabase
        .from("entrepreneur_persona_state")
        .select("persona_name, explanation, recommended_focus")
        .eq("entrepreneur_profile_id", entrepreneurProfile.id)
        .maybeSingle()
    : { data: null };

  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-navy-900 px-6 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="mb-10 flex justify-center"><SitheloLogo height={40} variant="light" /></div>
        <p className="text-white/50 text-sm mb-3">You&apos;re in, {firstName}.</p>
        <h1 className="text-hero font-display font-medium text-white leading-tight mb-10">We see you.</h1>

        {persona ? (
          <div className="space-y-5">
            <p className="text-white/80 text-lg">You&apos;re currently a <span className="font-medium text-white">{persona.persona_name}</span>.</p>
            <p className="text-white/60 leading-relaxed">{persona.explanation}</p>
            <div className="border-l-2 border-electric pl-5 mt-8 text-left">
              <div className="eyebrow-on-dark mb-2">Your next best step</div>
              <p className="text-white text-sm leading-relaxed">{persona.recommended_focus}</p>
            </div>
          </div>
        ) : (
          <p className="text-white/60">Sithelo is still putting your picture together. Head to your dashboard and it&apos;ll be ready shortly.</p>
        )}

        <div className="mt-10">
          <SitheloButton variant="on-dark" href="/entrepreneur/dashboard" className="px-8 py-3">Start</SitheloButton>
        </div>
      </div>
    </main>
  );
}
