# Sithelo 2.0: Public UI Implementation Report

**Branch:** `feat/sithelo-2-editorial-ui` (from `main` at `cf30cf9`)
**Scope:** public-facing presentation layer only. No database, migration, API, auth, scoring or verification logic was changed.
**Status:** committed locally on the feature branch. Not pushed, not merged, not deployed.

Status key: **PASS** (executed and passed), **FAIL** (executed and failed), **NOT TESTED** (could have been tested, was not), **BLOCKED** (could not be tested in this environment).

---

## 1. Repository audit summary

| Area | Finding |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 3 with tokens in `tailwind.config.ts` and component classes in `src/app/globals.css`. Default Tailwind breakpoints (no custom `screens`) |
| Fonts | Self-hosted via `@fontsource`: Inter (400/500/600/700) and Fraunces variable. The Fraunces italic file was imported but unused (removed) |
| Logo | `public/sithelo-logo.png`, 1774×887 RGBA. Measured artwork bounds: x 102–1665, y 41–860, so the artwork fills ~88% × 92% of the canvas. The logo looked small because it was rendered at 44px tall, not because of transparent padding |
| Public routes | `/`, `/for-entrepreneurs`, `/for-institutions`, `/about`, `/resources`, `/terms`, `/privacy`, `/login`, `/register`, `/register/check-email`, `/forgot-password`, `/reset-password` |
| Shared layout | `src/components/ui/MarketingChrome.tsx` (`SiteNav`, `SiteFooter`), `src/components/ui/MobileNav.tsx`; root skip link in `src/app/layout.tsx` |
| Business Passport (public) | Inline example on the homepage showing a numerical trust score (87) |
| Images | Self-hosted in `public/images` (`shop-owner.jpg`, `carpenter.jpg`, `engineer.jpg`), all under the Unsplash License |
| Animation | No animation library in use (`framer-motion` is installed but never imported) |
| Analytics / consent | None present. No trackers, no consent banner |
| Tests | Vitest unit tests (39), pgTAP database tests (need a live database). No component, end-to-end or accessibility test setup in the repo |
| Git | Clean working tree on `main`, in sync with `origin/main` |

Risks identified before starting:
- The authenticated app shares the `navy`/`ivory` Tailwind tokens. Changing them would restyle every dashboard, so the new palette was added as **separate tokens** used only by public pages.
- Copper (`#B47C54`) fails text contrast on light backgrounds (2.9:1 on linen). See section 2.

## 2. Design system summary

**New tokens** (`tailwind.config.ts`; public pages only):

| Token | Value | Use |
|---|---|---|
| `midnight` | `#102333` (+ `800`, `700` hover) | Primary text, primary buttons, dark sections |
| `linen` / `linen-deep` | `#EEE9DF` / `#E4DDD0` | Main page background / institution section |
| `paper` | `#FAF8F3` | Alternate sections, text on midnight |
| `copper` | `#B47C54` | Rules, hairlines and accents only (not small text on light) |
| `copper-ink` | `#8A5530` | Small copper text on light (eyebrows, numerals) |
| `copper-light` | `#D4A27C` | Copper text on midnight |
| `olive` / `olive-ink` | `#777F65` / `#5A6149` | Reserved: decorative / text variant |

Contrast, as computed (WCAG 2.x formula):

| Pair | Ratio | Verdict |
|---|---|---|
| midnight on linen / on paper | 13.25 / 15.10 | PASS AA |
| copper on linen | 2.92 | Text not allowed; decorative only |
| copper-ink on linen / on paper | 5.07 / 5.78 | PASS AA |
| copper on midnight | 4.54 | PASS AA |
| copper-light on midnight | 7.07 | PASS AA |
| olive on linen | 3.47 | Decorative only |
| olive-ink on linen | 5.36 | PASS AA |

**Type scale** (fluid, `clamp`):
- `m-hero`: 38px at 320–390, 72px at 1440. Within the 64–76 desktop and 38–46 mobile targets.
- `m-section`: 30px on phones, 52px on desktop.
- `m-title`: 22–28px.
- `m-lead` (body lead): 17–19px.

Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.

**Component classes** (`globals.css`, prefixed `m-` so they cannot collide with app styles):
- Layout and text: `m-container` (1240px), `m-section`, `m-eyebrow` / `m-eyebrow-on-dark`, `m-heading`, `m-lead`.
- Buttons and links: `m-btn-primary`, `m-btn-on-dark`, `m-btn-outline-on-dark` (48px min height, 6px radius), `m-link` / `m-link-on-dark` (44px targets, copper underline), `m-rule`.
- Motion: `m-reveal` (scroll-driven, CSS only), `m-hero-settle`.

**Components:**
- New: `src/components/marketing/PassportCredential.tsx`.
- Rebuilt: `SiteNav` (header), `SiteFooter`, `MobileNavToggle`.
- No other new components; sections live in `page.tsx`, following the existing project convention.

## 3. Changed files

| File | Change |
|---|---|
| `tailwind.config.ts` | New palette tokens and type scale (existing tokens untouched) |
| `src/app/globals.css` | `m-*` component classes, scroll reveal, hero settle animation |
| `src/app/layout.tsx` | Removed unused Fraunces italic font import |
| `src/app/page.tsx` | Homepage rebuilt in the 8-section architecture |
| `src/components/marketing/PassportCredential.tsx` | New Business Passport credential (no numerical score) |
| `src/components/ui/MarketingChrome.tsx` | New sticky header (logo +36–50%), new footer; removed unused `SiteNavOnDark` |
| `src/components/ui/MobileNav.tsx` | Restyled menu; visible "Get started" on phones; focus trap and focus return |
| `src/app/{about,for-entrepreneurs,for-institutions,privacy,resources,terms}/page.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx` | Header and footer moved outside `<main>` (correct landmarks; skip link now skips the nav) |
| `src/app/login/page.tsx` | "Forgot password?" link given a 24px minimum target |
| `docs/sithelo-2-qa/*.jpg` | Before/after screenshots |
| `docs/reports/SITHELO_2_UI_IMPLEMENTATION_REPORT.md` | This report |

## 4. Desktop implementation

**Header:**
- Sticky, 84px tall, translucent linen with a hairline border.
- Logo at 60px tall (was 44px, +36%).
- Inline nav: Entrepreneurs, Institutions, About, Resources (all existing routes).
- "Log in" and a primary "Create your Passport" button (`/register?role=entrepreneur`).

**Homepage sections:**

1. **Hero:**
   - Linen background; 52/48 grid; 650–760px tall.
   - The photo bleeds to the right viewport edge and dissolves into the linen with a 20% left-edge gradient mask. There's no card boundary.
   - Copy and CTAs as briefed: "Create your free Business Passport" and a "See how it works" link to `#how-it-works`.
   - The CIPC statement stays. It was verified against the code: the onboarding flow and `complete_entrepreneur_onboarding()` make business type and registration optional.
2. **The problem:** midnight background. "Good businesses deserve to be seen." with three typographic statements on copper hairlines.
3. **Business Passport:** paper background. The credential overlaps up into the navy band (a controlled overlap), next to a plain-language explanation.
4. **How it works:** linen background; four steps checked against the real flow:
   1. Register.
   2. Guided onboarding.
   3. Document upload and review.
   4. Automatic visibility once a document is verified, then apply.
5. **For entrepreneurs:** paper background. The carpenter photo bleeds to the left viewport edge and fades into the page. The four audiences, with an explicit note that requirements differ by business.
6. **For institutions:** `linen-deep` background, set out as numbered lines rather than cards.
   - Lists only live features: search, verified status, shortlisting, applications, and publishing after approval.
   - Primary CTA "Register your institution".
7. **Final conversion:** a photograph that dissolves into midnight, the closing line, and one CTA.
8. **Footer:** midnight background.
   - Three link groups: Platform, Account (including institution registration), Company (About, Terms, Privacy).
   - Shows a contact email only if one is configured.
   - Photo credit line.

**Content removed:**
- The numerical trust score example (87).
- The fake dashboard preview had already been removed on `main`.
- The previous hard-coded footer company name "Sithelo Group Holdings (Pty) Ltd". It now uses the configured legal name, falling back to "Sithelo", because the legal pages state the registered name is still to be published.

## 5. Mobile implementation

**Header:**
- 72px tall; logo at 52px.
- A visible "Get started" button sits beside the menu toggle, so registration is never hidden.
- The menu:
  - is a full-width linen panel with 52px nav rows;
  - offers "Create your Passport", "Log in" and "Register an institution";
  - closes on Escape, keeps Tab inside the panel, returns focus to the toggle when closed, and locks page scroll while open.

**Layout:**
- The hero headline and a full-width primary CTA come before the image.
- The image is cropped 4:3 to keep the subject's face, and fades into the navy section below.
- Every section stacks deliberately; the credential is capped at 560px on tablet.
- At 1024px the hero CTAs stack (they wrap side by side at that width); they sit inline from 1280px.

## 6. Business Passport visual changes

`PassportCredential` presents the Passport as a credential: midnight body, a single copper rule along the top, and a serif business name.

**Fields shown,** all of which exist in the data model:
- passport code, using the real `SIT-` prefix from migration 030;
- "Visible to institutions" (`is_published`);
- name, industry and location;
- four compliance records with status (`verifications`);
- dates (`documents.expiry_date`, including the "renew soon" state that maps to `expiring_soon`);
- capabilities (`business_capabilities`).

**Status presentation:** each status pairs an icon with a word (Verified / Renew soon / Under review), never colour alone.

**Labelling:** the example is labelled "Illustrative example. Karabo Civils is not a real business."

**Not shown:** no numerical score, and no share link (no share feature exists).

The authenticated passport page (`/passport/[id]`) still shows the trust score. It was **not changed**: the brief limits this work to the public site, and it forbids touching scoring.

## 7. Accessibility findings and fixes

| Check | Result |
|---|---|
| axe-core (WCAG 2.0/2.1/2.2 A+AA rules), 10 pages × 390px and 1440px | **PASS**: 0 violations (`/`, for-entrepreneurs, for-institutions, about, resources, terms, privacy, login, register, forgot-password) |
| Heading outline (homepage) | **PASS**: one H1, section H2s, step H3s (with "Step n:" for screen readers) |
| Mobile menu keyboard test (scripted) | **PASS**: opens on Enter, focus moves in, Tab stays inside after 12 presses, Escape closes, focus returns to toggle, focus ring visible |
| Horizontal overflow, 6 pages × 10 widths | **PASS**: 0px overflow everywhere |
| Clipped text, 6 pages × 10 widths | **PASS**: none (the only flag is the visually hidden skip link, by design) |
| Touch targets on public pages | **PASS** after fixes: header nav links raised from 39px to 44px; buttons 48–52px; "Forgot password?" raised to the 24px minimum |
| Reduced motion | **PASS**: reveal and settle animations sit behind `prefers-reduced-motion: no-preference`; content is never hidden for browsers without view timelines |
| Landmarks | **FIXED**: header and footer were inside `<main>` on eight pages |
| Text over photographs (photo captions) | **NOT TESTED** automatically (axe cannot evaluate text over images). Captions use a text shadow; check by eye |
| Screen reader pass (NVDA/VoiceOver) | **NOT TESTED** |
| Register page Terms/Privacy links (17px tall) | Inline links within a sentence, which WCAG 2.5.8 exempts. Left as is |

## 8. Performance (lab measurement)

Measured on a production build (`next build` + `next start`, local), median of runs:
- **Mobile:** 390px, 4× CPU throttle, 10 Mbps / 40 ms.
- **Desktop:** 1440px, unthrottled.

| Metric | Before (`main`) | After | Target | Status |
|---|---|---|---|---|
| LCP, mobile | 484 ms | 620 ms | ≤ 2500 ms | **PASS** |
| LCP, desktop | 160 ms | 156 ms | ≤ 2500 ms | **PASS** |
| CLS, mobile / desktop | 0 / 0.001 | 0 / 0.002 | ≤ 0.1 | **PASS** |
| Transferred, mobile | 497 KB | 487 KB | n/a | |
| Transferred, desktop | 507 KB | 569 KB | n/a | |
| JavaScript transferred | 212 KB | 221 KB | n/a | |
| INP | not measured | not measured | ≤ 200 ms | **NOT TESTED** (needs real interaction data) |

**Notes:**
- Mobile LCP rose about 0.14s because the hero photo is now the LCP element and is larger on phones. It still has `priority` loading and responsive `sizes`.
- Desktop weight rose because more photography is visible; below-the-fold images are lazy-loaded.
- These are lab figures from one machine, not 75th-percentile field data. No real-user monitoring exists.

## 9. Executed test results

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **PASS** (0 errors) |
| Lint | `npm run lint` | **PASS** (0 errors; 2 existing warnings in `src/lib/persona/determinePersona.ts`, unrelated) |
| Unit tests | `npm test` | **PASS** (39/39) |
| Production build | `next build` (placeholder Supabase env) | **PASS** |
| Accessibility | axe-core via Playwright (scratchpad tooling, not added to the repo) | **PASS** (0 violations) |
| Responsive overflow / clipping | Playwright script, 10 widths | **PASS** |
| Database tests | `npm run test:db` | **BLOCKED**: no staging database (account role prevents creating one; see previous session) |
| Registration / Passport user journeys | n/a | **BLOCKED**: no Supabase backend in this environment |
| End-to-end, component, visual-regression suites | n/a | **NOT TESTED**: none exist in the repo |

## 10. Visual evidence

Screenshots are in `docs/sithelo-2-qa/`, all taken from production builds:

- Before (`main`):
  - `before-home-1440.jpg`
  - `before-home-390.jpg`
  - `before-home-1440-full.jpg`
- After:
  - `after-home-1440.jpg`
  - `after-home-1920.jpg`
  - `after-home-1024.jpg`
  - `after-home-390.jpg`
  - `after-home-320.jpg`
  - `after-home-1440-full.jpg`
  - `after-home-768-full.jpg`
  - `after-credential-320.jpg`

All ten widths (320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920) were captured and reviewed during QA. The set above is representative.

## 11. Outstanding issues and limitations

1. **Photography:** resolved in revision 2 (below). All photos are now South African. Portraits of individual South African entrepreneurs are still missing; see revision 2 for why.
2. **"Free" claim.** "Create your free Business Passport" matches the current app (there is no billing), but it is a commercial commitment the owner should confirm before launch.
3. **Inner public pages** (for-entrepreneurs, for-institutions, about, resources, terms, privacy) received the new header and footer only. Their bodies still use the previous ivory/navy styling and should get the same treatment in a follow-up.
4. **No accessibility statement or contact page exists.** The footer shows a contact email only once `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` is set.
5. **Analytics:** none exist and none were added. Proposed event plan, to implement only once a consent mechanism is chosen:

   | Event | Fires when |
   |---|---|
   | `passport_cta_clicked` | Any "Create your Passport" link is clicked (property: page section) |
   | `institution_cta_clicked` | "Register your institution" or the institutions page link is clicked |
   | `registration_started` | The `/register` form is submitted |
   | `registration_completed` | `signUp` succeeds |
   | `passport_started` | The onboarding wizard is opened |
   | `passport_completed` | `/api/onboarding/complete` returns 200 |

6. **Authenticated passport page** still shows the numerical trust score (out of scope, see section 6).
7. **`framer-motion`** remains in `package.json` but unused; removing it was outside a presentation-only change.

## 12. Functional regression assessment

- **Unchanged:**
  - auth flows (login, register and password-reset logic and routes; only the forgot-password link's size changed);
  - the session proxy, API routes, Supabase clients, migrations, edge functions, scoring and verification.
- **Routes:** every route linked from the header, menu and footer exists. Registration links use the same `?role=` parameters the register page already reads.
- **Signed-in app:** the `navy`/`ivory` tokens and `btn-*` classes it uses are unchanged.
- **Confidence:** high for the presentation layer (build, types, lint and units pass; DOM checks across 10 widths). User journeys against a real backend remain **BLOCKED** (section 9).

## 13. Readiness recommendation

**Ready for review and staging, not for production.** The public redesign meets the brief's visual, responsive, accessibility and performance criteria where they could be measured. Before release:

1. Run registration and passport journeys against a staging Supabase project.
2. Replace the three photos with South African imagery, or accept the honest captions.
3. Confirm the "free" claim.
4. Review the branch and merge only on explicit approval.

### Acceptance criteria

| Criterion | Status |
|---|---|
| Logo has a stronger visual presence | PASS (60px desktop / 52px mobile, was 44px) |
| Homepage no longer excessively white or empty | PASS |
| Photography blends into surrounding sections | PASS |
| Warm, human-centred design | PASS (subjective; review screenshots) |
| Navy sections give deliberate contrast | PASS |
| Elegant, readable typography | PASS |
| Business Passport reads as a premium credential | PASS |
| Clear conversion journey | PASS |
| Polished desktop / intentional mobile | PASS (10 widths reviewed) |
| Navigation functional | PASS (links, keyboard menu test) |
| Authentication / registration functional | BLOCKED (no backend); code unchanged |
| Business Passport workflows intact | BLOCKED (no backend); code unchanged |
| Accessibility met or gaps documented | PASS (section 7) |
| Performance measured, regressions addressed | PASS (section 8) |
| Existing tests pass | PASS (unit, types, lint, build); DB tests BLOCKED |
| No unauthorised backend changes | PASS |
| No production deployment | PASS |
| Markdown report produced | PASS |

---

## Revision 2 (owner feedback, 17 Nov 2026)

Requested: South African photographs only; a subtle South Africa map silhouette instead of plain backgrounds; floating, lightly glassmorphic buttons; the Business Passport made the hero and given depth.

### Photography: South African only

All three previous photos were removed from `public/images`: two were taken in Dar es Salaam and the third had no stated location. The replacements' locations were checked on each photo's own Unsplash page; all are free under the Unsplash License.

| File | Where used | Location (stated on Unsplash) | Photographer | Source |
|---|---|---|---|---|
| `jhb-construction.jpg` | Hero (behind the Passport), for-institutions page | Parktown, Johannesburg | Mark Potterton | unsplash.com/photos/sNVkn3507Oo |
| `jhb-rosebank-crafts.jpg` | For entrepreneurs section, for-entrepreneurs page | Rosebank, Johannesburg | Vije Vijendranath | unsplash.com/photos/lcPbyRE-xzY |
| `cape-town.jpg` | Final conversion section | Cape Town | Tobias Reich | unsplash.com/photos/1GgWbP74phY |

**Limitation:** free, location-verified South African photos of an individual entrepreneur at work (a spaza owner, tailor, mechanic and so on) were not found. Searches covered Unsplash and Pexels for Soweto, Johannesburg, Cape Town, Durban, townships and spaza shops. The site therefore uses a South African construction site, South African-made goods and Cape Town. A commissioned shoot or a licensed South African stock library is the way to add portraits.

### South Africa map

`src/components/marketing/SouthAfricaMap.tsx` is generated from Natural Earth 1:50m boundaries (public domain): mainland outline with Lesotho cut out, and the Prince Edward Islands omitted. It is not hand-drawn, and it is decorative, so hidden from assistive technology.

It appears twice:
- behind the hero headline (midnight at 5% opacity);
- in the Business Passport section (copper at 8%, from 768px up).

### Buttons

- **Primary:** midnight gradient with a top highlight and a layered "floating" shadow; lifts 2px on hover.
- **Secondary, light backgrounds:** new `m-btn-glass`, frosted (white at 45%, medium backdrop blur, fine white border).
- **Secondary, dark backgrounds:** new `m-btn-glass-dark`.
- Radius 8px; 48–52px tall. The lift is a transform, so it never shifts layout.

### Business Passport as the hero

- The credential now sits in the hero, floating across the seam between the linen and the Johannesburg photo.
- Layered shadow, a fine light ring and a faint top sheen give it depth. Its caption is a frosted chip so it stays readable over the photo.
- A slow 8px drift runs every 7s. It is a transform, and it is off when reduced motion is requested.
- On phones it overlaps the bottom of the photo, after the headline and CTAs.
- The Passport section further down now explains the four parts of a Passport instead of repeating the card.

### Backgrounds

The near-white `paper` sections are now warm `linen`, alternating with `linen-deep`.

### QA for revision 2 (executed)

| Check | Result |
|---|---|
| Typecheck, lint, unit tests (39), production build | **PASS** (lint: the same 2 old warnings) |
| axe-core, home + for-entrepreneurs + for-institutions at 390 and 1440 | **PASS** (0 violations) |
| Overflow / clipped text, 3 pages × 10 widths | **PASS** (30/30) |
| Mobile menu keyboard test | **PASS** |
| Photo caption contrast (computed, worst case: over pure white) | **FIXED**: 2.63:1 at the first 45% backing; raised to 70% for 5.64:1 |
| LCP mobile / desktop (median of 5) | 664 ms / 188 ms, **PASS** (≤ 2500 ms) |
| CLS mobile / desktop | 0 / 0.004, **PASS** |
| Transferred, desktop | 790 KB (was 569 KB): the full-width Cape Town photo, lazy-loaded below the fold |

Screenshots in `docs/sithelo-2-qa/after-*.jpg` were replaced with revision 2 captures.

### Revision 2.1: photo credits removed

At the owner's request, the on-page photo credits and the footer's "Photography under the Unsplash License" line were removed. The Unsplash License does not require attribution, so no licence condition is affected. Photographers and source links remain recorded in the revision 2 table above. Accessibility recheck on the homepage at 390 and 1440: 0 violations.
