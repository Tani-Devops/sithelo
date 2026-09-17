"use client";

export interface EnterOptions {
  /** ms before the animation starts — used to stagger a sequence. */
  delay?: number;
  duration?: number;
  /** px the element starts translated down by. */
  distance?: number;
}

const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Animates an element in with the browser's native Web Animations API —
 * opacity + transform only, so it runs on the compositor thread (GPU path,
 * no layout thrash) and stays interruptible if it's re-triggered mid-flight.
 * No animation library, no runtime dependency: see the WEBNAILED "WAAPI"
 * motion-skill reference this is adapted from.
 *
 * Skips straight to the end state if the user has requested reduced motion.
 */
export function enter(el: Element | null, { delay = 0, duration = 600, distance = 16 }: EnterOptions = {}) {
  if (!el) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    (el as HTMLElement).style.opacity = "1";
    (el as HTMLElement).style.transform = "none";
    return;
  }

  el.animate(
    [
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration, delay, easing: EASING, fill: "both" }
  );
}
