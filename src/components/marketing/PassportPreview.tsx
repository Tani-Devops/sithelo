"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge } from "./Gauge";
import { IconChevronDown, IconX } from "./icons";
import { enter } from "@/lib/motion/enter";

// The three preview cards that bleed off the bottom edge of the hero.
// These illustrate what a completed Business Passport looks like using a
// fictional example business — they are never live platform statistics,
// so every number here is explicitly labelled "Example" rather than
// carrying the kind of "This Month" / "+12 (16%)" / "Compared to
// yesterday" framing that would read as real, current platform activity.
// See landing page audit notes: this preview must never imply real
// traction, aggregate figures, or a specific business's live data.
export function PassportPreview() {
  const [trustToggle, setTrustToggle] = useState<"trust" | "compliance">("trust");
  const [oppToggle, setOppToggle] = useState<"funding" | "procurement">("funding");
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);

  // Each card enters from its trigger — the hero's own entrance sequence —
  // rather than firing independently, so the three feel like one
  // continuation of the same moment instead of three separate reveals.
  useEffect(() => {
    enter(card1Ref.current, { delay: 420, distance: 14 });
    enter(card2Ref.current, { delay: 480, distance: 14 });
    enter(card3Ref.current, { delay: 540, distance: 14 });
  }, []);

  return (
    <div className="px-3 sm:px-4">
      <div className="bg-ivory rounded-3xl p-4 sm:p-6 w-full max-w-[880px] mx-auto shadow-lift">
        <p className="text-center text-[11px] font-medium tracking-wide uppercase text-ink-500 mb-3">
          Example Business Passport preview — not live platform data
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Card 1 — Trust Score */}
          <div ref={card1Ref} className="bg-white rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[13px] font-semibold text-blue-600">Trust Score</span>
              <span className="text-[13px] text-ink-500">Example</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[28px] font-semibold text-navy leading-none">87</span>
            </div>
            <p className="text-xs text-ink-500 mb-4">Illustrative score for a sample business</p>
            <p className="text-center text-xs font-medium text-ink-600 mb-1">Example verification snapshot</p>
            <Gauge value={87} color="#2F7BF6" showLabels min={0} max={100} />
            <div className="mt-4 bg-grey-50 rounded-full p-1 flex text-xs font-medium">
              <button
                type="button"
                onClick={() => setTrustToggle("trust")}
                className={`flex-1 rounded-full py-1.5 transition-all duration-200 ease-brand ${trustToggle === "trust" ? "bg-white shadow-sm text-navy" : "text-ink-500"}`}
              >
                Trust Score
              </button>
              <button
                type="button"
                onClick={() => setTrustToggle("compliance")}
                className={`flex-1 rounded-full py-1.5 transition-all duration-200 ease-brand ${trustToggle === "compliance" ? "bg-white shadow-sm text-navy" : "text-ink-500"}`}
              >
                Compliance
              </button>
            </div>
          </div>

          {/* Card 2 — Passport settings (form) */}
          <div ref={card2Ref} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <div>
              <label className="text-xs text-ink-700 mb-1 block">Show verification for</label>
              <button type="button" className="w-full flex items-center justify-between border border-line rounded-lg px-3 py-2 text-sm text-navy">
                This business <IconChevronDown className="w-3.5 h-3.5 text-ink-500" />
              </button>
            </div>
            <div>
              <label className="text-xs text-ink-700 mb-1 block">Compare against</label>
              <button type="button" className="w-full flex items-center justify-between border border-line rounded-lg px-3 py-2 text-sm text-navy">
                Industry benchmark (MTD) <IconChevronDown className="w-3.5 h-3.5 text-ink-500" />
              </button>
            </div>
            <div>
              <label className="text-xs text-ink-700 mb-1 block">CIDB grade target</label>
              <div className="flex items-center border border-line rounded-lg px-3 py-2 text-sm text-navy">
                <span className="text-ink-500 mr-1">#</span> 6
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-700 mb-1 block">B-BBEE level target</label>
              <div className="flex items-center border border-line rounded-lg px-3 py-2 text-sm text-navy">
                <span className="text-ink-500 mr-1">#</span> 2
              </div>
            </div>
            <div className="flex items-center mt-1">
              <button type="button" className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200 ease-brand hover:bg-blue-700 hover:-translate-y-0.5">
                Save
              </button>
              <button type="button" className="ml-4 text-sm text-ink-600 underline underline-offset-2">
                Cancel
              </button>
              <IconX className="w-4 h-4 text-ink-500 ml-auto" />
            </div>
          </div>

          {/* Card 3 — Opportunities matched */}
          <div ref={card3Ref} className="bg-white rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[13px] font-semibold text-blue-600">Opportunities Matched</span>
              <span className="text-[13px] text-ink-500">Example</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[28px] font-semibold text-navy leading-none">3</span>
            </div>
            <p className="text-xs text-ink-500 mb-4">Illustrative match count for a sample business</p>
            <div className="mt-6">
              <Gauge value={68} color="#9ca3af" />
            </div>
            <div className="mt-4 bg-grey-50 rounded-full p-1 flex text-xs font-medium">
              <button
                type="button"
                onClick={() => setOppToggle("funding")}
                className={`flex-1 rounded-full py-1.5 transition-all duration-200 ease-brand ${oppToggle === "funding" ? "bg-white shadow-sm text-navy" : "text-ink-500"}`}
              >
                Funding
              </button>
              <button
                type="button"
                onClick={() => setOppToggle("procurement")}
                className={`flex-1 rounded-full py-1.5 transition-all duration-200 ease-brand ${oppToggle === "procurement" ? "bg-white shadow-sm text-navy" : "text-ink-500"}`}
              >
                Procurement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
