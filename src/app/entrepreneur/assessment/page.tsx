// ====================================================================
// /entrepreneur/assessment — the adaptive Sithelo Entrepreneurial
// Journey Assessment. Server component wrapper; the adaptive logic runs
// in the client component (which is fed only by the assessment API).
// ====================================================================
import { requireEntrepreneur } from "@/lib/auth/guards";
import { JourneyAssessment } from "@/components/assessment/JourneyAssessment";
import { SitheloLogo } from "@/components/ui/sithelo";

export default async function AssessmentPage() {
  await requireEntrepreneur();

  return (
    <main id="main-content" className="min-h-screen bg-soft py-12 px-6">
      <div className="max-w-xl mx-auto mb-8">
        <div className="flex justify-center mb-6"><SitheloLogo height={44} /></div>
        <div className="text-center mb-2">
          <div className="eyebrow mb-2">Your entrepreneurial journey</div>
          <h1 className="text-display-lg font-display font-medium text-navy leading-tight">
            Let&apos;s understand where you are.
          </h1>
          <p className="text-sm text-ink-600 mt-3 max-w-md mx-auto">
            A short, personal assessment. There are no wrong answers, and you don&apos;t need a registered business. We only ask what&apos;s relevant to you.
          </p>
        </div>
      </div>
      <JourneyAssessment />
    </main>
  );
}
