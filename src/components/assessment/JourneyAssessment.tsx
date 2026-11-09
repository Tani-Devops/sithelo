"use client";

// ====================================================================
// JourneyAssessment — the adaptive Sithelo Entrepreneurial Journey
// Assessment client. One calm question at a time, with branching handled
// server-side (the client never decides which question comes next — it
// only renders what the server returns).
//
// Feels like "Sithelo is trying to understand me", not an interrogation:
// each question carries a plain-language "why we ask" note, and progress
// is a thin journey bar rather than a numbered stepper.
// ====================================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SitheloButton } from "@/components/ui/sithelo";
import { SECTION_TITLES } from "@/lib/assessment/types";
import type { AnswerValue, AssessmentSection } from "@/lib/assessment/types";

interface PublicOption {
  value: string;
  label: string;
}

interface PublicQuestion {
  id: string;
  section: AssessmentSection;
  prompt: string;
  whyAsked: string;
  responseType: string;
  options?: PublicOption[];
  min?: number;
  max?: number;
}

interface StartResponse {
  assessment_id?: string;
  question?: PublicQuestion | null;
  total_relevant?: number;
  answered_relevant?: number;
  complete?: boolean;
  error?: string;
}

interface AnswerResponse {
  question?: PublicQuestion | null;
  total_relevant?: number;
  answered_relevant?: number;
  complete?: boolean;
  error?: string;
}

type Phase = "loading" | "question" | "complete" | "error";

export function JourneyAssessment() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [total, setTotal] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [selection, setSelection] = useState<AnswerValue>(null);
  const [textValue, setTextValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const finish = useCallback(
    async (id: string) => {
      try {
        const res = await fetch("/api/assessment/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessment_id: id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not finish the assessment.");
          setPhase("error");
          return;
        }
        setPhase("complete");
        router.push("/entrepreneur/journey");
      } catch {
        setError("Something went wrong. Please try again.");
        setPhase("error");
      }
    },
    [router]
  );

  const start = useCallback(async () => {
    try {
      const res = await fetch("/api/assessment/start", { method: "POST" });
      const data: StartResponse = await res.json();
      if (!res.ok || !data.assessment_id) {
        setError(data.error ?? "Could not start the assessment.");
        setPhase("error");
        return;
      }
      setAssessmentId(data.assessment_id);
      setTotal(data.total_relevant ?? 0);
      setAnswered(data.answered_relevant ?? 0);
      if (data.complete || !data.question) {
        await finish(data.assessment_id);
        return;
      }
      setQuestion(data.question);
      setPhase("question");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [finish]);

  // Fetch-on-mount data loading. The set-state-in-effect rule fires here
  // because it can't trace through the useCallback ref, but every
  // setState inside start() happens AFTER an await — nothing is set
  // synchronously, so there's no cascading-render concern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; setState in start() is post-await only
    void start();
  }, [start]);

  function currentValue(): AnswerValue {
    if (question?.responseType === "text") return textValue.trim() || null;
    return selection;
  }

  async function submit() {
    if (!question || submitting) return;
    const value = currentValue();
    if (value === null || (Array.isArray(value) && value.length === 0)) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/assessment/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessment_id: assessmentId, question_id: question.id, answer: value }),
      });
      const data: AnswerResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save your answer.");
        setSubmitting(false);
        return;
      }
      setTotal(data.total_relevant ?? total);
      setAnswered(data.answered_relevant ?? answered + 1);
      setSelection(null);
      setTextValue("");
      if (data.complete || !data.question) {
        await finish(assessmentId);
        return;
      }
      setQuestion(data.question);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="max-w-xl mx-auto">
        <div className="h-[3px] bg-line rounded-sm mb-10 animate-pulse" />
        <div className="card space-y-4">
          <div className="skeleton h-6 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-4/5" />
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card text-center py-12">
          <h2 className="font-display font-medium text-navy text-lg mb-2">We couldn&apos;t load the assessment</h2>
          <p className="text-sm text-ink-600 mb-5">{error}</p>
          <SitheloButton onClick={() => { setError(null); setPhase("loading"); void start(); }}>
            Try again
          </SitheloButton>
        </div>
      </div>
    );
  }

  if (phase === "complete" || !question) {
    return null;
  }

  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
  const answerValue = currentValue();
  const canSubmit = answerValue !== null && !(Array.isArray(answerValue) && answerValue.length === 0);

  return (
    <div className="max-w-xl mx-auto">
      {/* Journey indicator */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Assessment progress: ${progress}%`}
        className="mb-4"
      >
        <div className="h-[3px] bg-line rounded-sm overflow-hidden">
          <div className="h-full bg-navy transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-eyebrow text-ink-500">{SECTION_TITLES[question.section]}</span>
          <span className="text-eyebrow text-ink-500">{answered} of {total || "?"}</span>
        </div>
      </div>

      <div className="card space-y-6">
        <h1 className="text-2xl font-display font-medium text-navy leading-tight">{question.prompt}</h1>

        <p className="text-sm text-ink-600 border-l-2 border-blue-600 pl-4">
          <span className="font-medium text-navy">Why we ask: </span>
          {question.whyAsked}
        </p>

        <QuestionInput
          question={question}
          selection={selection}
          textValue={textValue}
          onSelect={setSelection}
          onText={setTextValue}
        />

        {error && <p role="alert" aria-live="polite" className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <SitheloButton onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? "Saving…" : "Next"}
          </SitheloButton>
        </div>
      </div>
    </div>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-sm px-4 py-2 rounded-sm border transition-colors ${
        selected ? "bg-navy text-white border-navy" : "border-line text-ink-600 hover:border-navy"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionInput({
  question,
  selection,
  textValue,
  onSelect,
  onText,
}: {
  question: PublicQuestion;
  selection: AnswerValue;
  textValue: string;
  onSelect: (v: AnswerValue) => void;
  onText: (v: string) => void;
}) {
  const options = question.options ?? [];

  if (question.responseType === "boolean") {
    return (
      <div className="flex gap-2">
        <Pill selected={selection === true} onClick={() => onSelect(true)}>Yes</Pill>
        <Pill selected={selection === false} onClick={() => onSelect(false)}>No</Pill>
      </div>
    );
  }

  if (question.responseType === "text") {
    return (
      <textarea
        rows={3}
        value={textValue}
        onChange={(e) => onText(e.target.value)}
        className="input"
        placeholder="Answer in your own words"
      />
    );
  }

  if (question.responseType === "multi") {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = Array.isArray(selection) && selection.includes(o.value);
          return (
            <Pill
              key={o.value}
              selected={selected}
              onClick={() => {
                const current = Array.isArray(selection) ? selection : [];
                onSelect(selected ? current.filter((v) => v !== o.value) : [...current, o.value]);
              }}
            >
              {o.label}
            </Pill>
          );
        })}
      </div>
    );
  }

  // single, scale, number — all render as a single-select pill group
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Pill key={o.value} selected={selection === o.value} onClick={() => onSelect(o.value)}>
          {o.label}
        </Pill>
      ))}
    </div>
  );
}
