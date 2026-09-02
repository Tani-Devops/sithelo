# Sithelo — Design System

## Brand

**Sithelo** — "Helping entrepreneurs turn efforts into results." A South African entrepreneur infrastructure platform, not an AI company, generic SaaS dashboard, or fintech app. The interface should feel premium, optimistic, human, and confident — closer to a modern editorial publication or a premium credential than a dense admin panel.

**Logo:** `/public/sithelo-logo.png` — the approved wordmark, used as-is, never redesigned or recreated. Documented discrepancy: the logo itself uses black/olive-sage/gold, not the sky-blue system below. Per the brief's own rule ("do not redesign the logo"), the logo is used unmodified; the color system governs the surrounding interface, not the mark itself. Flagging this rather than silently resolving it one way or the other.

## Color tokens

| Token | Hex | Tailwind class | Usage |
|---|---|---|---|
| Sky | `#67C7F2` | `sky` | Primary accent, ring gradients, highlights |
| Deep Sky | `#3AAFE3` | `sky-deep` | Button gradient start, hover borders |
| Cobalt | `#3157D5` | `cobalt` | Button gradient end, links, primary CTAs |
| Deep Navy | `#10243E` | `navy` | Headings, sidebar/hero surfaces, credential cards |
| Teal | `#159A9C` | `teal` | Verified status, balance accent |
| Ivory | `#F8F5ED` | `ivory` | Warm section backgrounds |
| Champagne | `#D9C39A` | `champagne` | Pending-status warmth, premium accents |
| Soft background | `#F4F8FA` | `soft` | App-wide page background |
| Charcoal | `#18212B` | `charcoal` | Deepest navy-gradient endpoint |
| Ink | `#18212B` / `#5B6673` | `ink-900` / `ink-600` | Body text / muted text |
| Line | `#E4E7EA` | `line` | Borders, dividers |

Olive green is explicitly rejected as a UI color per the brief ("reads too agricultural") — it appears only in the fixed logo asset, nowhere else.

## Typography

- **Display** (headings, large numbers): Manrope, 600–800 weight — editorial character, used for `h1`–`h4` and anything meant to feel like a headline.
- **Body / UI**: Inter, 400–700 weight — maximum legibility at small sizes (metadata, labels, table cells).
- Loaded via `<link>` in `layout.tsx`, not `next/font/google` — avoids coupling the build itself to a third-party network fetch succeeding (confirmed necessary: `next/font` failed to build in this environment's sandbox; `<link>` has no build-time dependency either way).
- Large headline: `text-3xl` to `text-[52px]`, `font-display font-bold tracking-tight`.
- Body: `text-sm`/`text-base`, `font-sans`, `leading-relaxed`.
- Avoid anything below `text-xs` (11px) — the brief explicitly calls out avoiding tiny UI typography.

## Spacing & radius

- Base unit 4px, common increments 16/20/24/32.
- Card padding: 24px (`p-6`).
- Card radius: 16px (`rounded-card`) — softer than a generic SaaS 8px, short of "AI startup" 24px+.
- Buttons/inputs: `rounded-xl` (12px).
- Badges: fully rounded (`rounded-full`).

## Elevation

- `shadow-float` — the default card shadow: barely-there (`0 1px 2px`) plus a soft, wide ambient shadow (`0 12px 32px -12px`). Floating, not flat, not heavy.
- `shadow-glow` — reserved for hero imagery / the Business Passport credential card: a soft sky-blue glow ring, used sparingly (once per screen at most), never on every component (the brief explicitly warns against "everything becomes a floating glass card").

## Core components (`src/components/ui/sithelo.tsx`)

| Component | Purpose |
|---|---|
| `SitheloButton` | `primary` (gradient sky→cobalt), `ghost` (white/bordered), `dark` (navy) |
| `SitheloCard` | Standard floating surface |
| `SitheloBadge` / `SitheloStatus` | Status pills — `SitheloStatus` maps a raw backend status string (`verified`, `pending_review`, `awarded`, etc.) to the correct tone automatically, so no screen hand-rolls status color logic |
| `SitheloAvatar` | Initials-based avatar circle |
| `SitheloMetric` | Label + large display-font value, used in stat grids |
| `SitheloRing` | **The signature element.** Sky→cobalt gradient progress ring on a navy surface — used for trust score and verification percentage. The one recurring motif tying the entrepreneur home and the Business Passport together, deliberately not reused everywhere else (a signature should be occasional, not wallpaper). |
| `SitheloEmptyState` | Title + explanation + action — never "No data." |
| `SitheloErrorState` | Human-language error, never a raw backend message |
| `SitheloSkeleton` | Loading placeholder |
| `SitheloLogo` | The logo asset, sized consistently |

Every screen should compose these rather than writing one-off Tailwind strings for buttons/badges/cards — this was a real gap in the pre-rebrand codebase (each page hand-rolled its own status pill classes) and is why `SitheloStatus` exists as a single mapping now used consistently.

## Layout pattern: the "command centre," not a card wall

Per the brief's explicit example, the entrepreneur home leads with one floating navy surface containing the trust-score ring plus 2–3 key figures, not four-plus stat cards in a row. Secondary information (messages, business summary) drops to a lighter three-card row below. The Business Passport uses the same navy "credential" surface as its header, reinforcing the ring as one consistent signature across the two most important screens rather than introducing a different treatment per page.

## Status color mapping (`SitheloStatus`)

| Backend status | Tone | Visual |
|---|---|---|
| `verified`, `valid`, `active`, `awarded` | Verified | Teal |
| `pending`, `pending_review`, `under_review`, `submitted`, `shortlisted` | Pending | Champagne |
| `rejected`, `expired`, `withdrawn` | Rejected | Red |
| anything else | Neutral | Grey |

## Empty / loading / error states

- Empty: always names what's missing and what to do next (`SitheloEmptyState`) — never "No data."
- Loading: skeletons (`SitheloSkeleton`), not spinners, per the brief.
- Error: human language only (`SitheloErrorState`) — no SQL/Supabase error text, no stack traces, no internal IDs. This is also a security-adjacent rule, not just a style one: the login/register pages were fixed this pass to stop surfacing raw `authError.message`/`signUpError.message` text, which could leak backend implementation detail.

## Accessibility

- All interactive elements are real `<button>`/`<a>` (via `SitheloButton`'s `href` prop), never a styled `<div>` with an `onClick`.
- Color is never the only status signal — `SitheloStatus` always pairs color with a text label.
- Focus states: `input`/`.input` uses a visible `ring-2` on focus, not just a border-color change.

## Onboarding wizard pattern (Aug 2026 pass)

`OnboardingWizard.tsx` introduces two small additions used only there so far:

- **Journey indicator** — a row of thin filled/unfilled bars (`bg-cobalt` / `bg-line`), one per step, deliberately not a numbered-circle wizard stepper. Matches the brief's "avoid a generic multi-step SaaS wizard" instruction.
- **`Pill`** — a rounded-full toggle button (selected: solid cobalt; unselected: bordered) used for range/multi-select questions (revenue bands, challenges, goals) instead of native radio/checkbox inputs. Not yet promoted to `sithelo.tsx` as a shared component — if a second screen needs the same pattern, it should move there rather than being redefined locally.

## What this pass covered vs. did not (Aug 2026 — Sithelo MVP directive)

Built to the design system: onboarding wizard, "We see you" completion screen (navy full-bleed, matching the Business Passport header treatment), `/entrepreneur/journey`, opportunity detail (entrepreneur + institution sides), institution opportunity creation, Business Passport edit page. All reuse `SitheloButton`/`SitheloBadge`/`.card`/`.input` rather than one-off Tailwind.

**Not built this pass:** the passport edit page and capability/asset manager are functional but plain-form styled (no `SitheloRing`/hero treatment) — lower priority than closing the functional gap first. See ROADMAP.md.

