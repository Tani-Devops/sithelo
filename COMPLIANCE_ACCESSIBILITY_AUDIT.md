# SITHELO COMPLIANCE & ACCESSIBILITY AUDIT

Date: 2026-09-07
Scope: full Next.js app (`src/`), Supabase edge functions, config, and existing
legal pages. Read the actual code before marking anything — nothing below was
assumed from the business model description alone.

## Executive Summary

| Area | Status |
|---|---|
| Accessibility | NEEDS WORK → fixed this pass |
| Privacy | NEEDS WORK → improved this pass, legal review still required |
| Legal pages | NEEDS WORK → structurally complete, legal review still required |
| Tracking | PASS (none present) |
| Forms | NEEDS WORK → fixed this pass |
| Content trust | NEEDS WORK → fixed this pass |

Sithelo's prior passes already got the hard things right: no fake stats, no
fake logos, no payment system to fabricate a refund policy for, and honest
`[PLACEHOLDER]`-marked legal drafts instead of invented terms. This pass found
and fixed real gaps in contrast, form accessibility, mobile dashboard
navigation, two leftover-branding bugs, and one dead/one broken button — it
did not need to invent a compliance system Sithelo doesn't actually need.

## Audit Table

| Area | Status | Finding | Action Taken |
|---|---|---|---|
| Colour contrast | ⚠️ NEEDS FIX → ✅ | `ink-500` (3.9:1) and `pending`/`champagne` (3.7:1) both failed AA at the small text sizes they're actually used at (form labels, eyebrows, badges). Several `white/35–45` text instances on navy also failed. | Darkened `ink-500` → `#687080` (~5.0:1) and `pending`/`champagne` → `#8F5D1B` (~5.6:1) in `tailwind.config.ts`. Bumped `white/35`→`/60` and `white/45`→`/50` in three spots. Same hue families, brand direction unchanged. |
| Alt text | ✅ PASS | Every meaningful `<Image>` already has real descriptive alt text (not filenames, not keyword-stuffed). No decorative images needing empty alt. | None needed. |
| Refund policy | N/A | Grepped for Stripe/Paystack/PayFast/checkout/billing — Sithelo processes no payments anywhere in the codebase. | No refund policy added — would be fabricating obligations for a business model that doesn't exist yet. |
| Privacy Policy | ⚠️ NEEDS FIX → ✅ | Existing draft (already marked "needs legal review") didn't disclose third parties or cookie posture. | Added a real "Third parties we use" section (Supabase, Resend, Google Fonts — including the IP-to-Google note) and a "Cookies" section explaining why no consent banner is needed. Legal-review placeholder banner kept, not removed. |
| Accessibility | ⚠️/❌ → ✅ | See detailed items below (skip link, forms, mobile portal nav, aria-live, aria-pressed, aria-current). | Fixed — see "Files Changed." |
| Fake reviews | ✅ PASS | Already removed in a prior pass (comment in `page.tsx` documents this explicitly); grepped again, found none. | None needed. |
| Terms & Conditions | ⚠️ minor | Structurally sound honest draft already existed. | No content change — still needs legal review and the bracketed company details filled in (see Remaining Human Decisions). |
| Third-party services | ❌ MISSING (disclosure) → ✅ | Found: Supabase (db/auth/storage), Resend (email), Google Fonts (loaded via `<link>`, not self-hosted), and two *inactive* integrations wired in code but not called anywhere (AI provider abstraction, WhatsApp Cloud API). No analytics, ads, chat widgets, CAPTCHA, maps, or payment providers. | Documented all of these in the Privacy Policy. Did not add tracking that doesn't exist. |
| Image copyright | ⚠️ FLAG | All photography is served directly from `images.unsplash.com` (hotlinked, not downloaded/re-hosted). Unsplash's license permits this use, but hotlinking means Sithelo has no control if an image is ever taken down or its license terms change. | Flagged only — recommend downloading and re-hosting the ~5 hero images before launch so the site isn't dependent on a third party's URL staying valid. Not changed in this pass (no unnecessary dependency added). |
| Cookies | ✅ PASS (N/A for consent) | Only cookie in use is the Supabase Auth session cookie — strictly necessary, no consent required under POPIA/ECTA. No localStorage/sessionStorage tracking found anywhere in `src/`. | Documented in Privacy Policy. No banner added (would be a dark pattern for cookies that don't need consent). |
| Tracking | ✅ PASS | Grepped for GA/GTM/Meta Pixel/TikTok/Hotjar/Clarity/PostHog/Mixpanel/Segment/Sentry — none present. `error.tsx` has a comment noting Sentry isn't wired up yet. | None needed. |
| Form consent | ❌ MISSING → ✅ | Registration collected name/email/phone/password with no Privacy Policy link and no consent checkbox anywhere. | Added a required "I agree to the Terms of Service and Privacy Policy" checkbox to `/register`, linking both actual pages. Not pre-checked. No marketing-consent checkbox added (there's no marketing use of this data to consent to). |
| South African requirements | ⚠️ FLAG | POPIA/ECTA/CPA are the right frameworks given account creation + document uploads + business data. Existing drafts already flag "needs POPIA-aware legal review" honestly. | No compliance claims added or implied. Technical measures (consent checkbox, third-party disclosure, data-access-tier documentation already in the Privacy Policy) implemented; legal sign-off is a human decision, flagged below. |
| Button labels | ⚠️ NEEDS FIX → ✅ | "Get Started" (×2), and "Request a Demo" — the latter went straight to self-service registration, not any demo-booking flow, which is actively misleading. | "Get Started" → "Create your business profile" (×2). "Request a Demo" → "Register your institution" (label now matches the actual action). |
| Cookie consent | N/A | No non-essential cookies exist to require consent for. | No banner added. |
| Business details | ⚠️ FLAG (unchanged) | Footer already correctly says "Sithelo Group Holdings (Pty) Ltd" with no fabricated registration number/address/phone. Terms page has honest `[REGISTRATION DETAILS]` / `[PHYSICAL ADDRESS]` placeholders. No support email exists anywhere. | Left as-is — this is correct behavior (not inventing details), just still incomplete. See Remaining Human Decisions. |
| Data minimisation | ✅ mostly PASS | Onboarding wizard collects sensitive household/income context, but this is core to the product's persona-based guidance, is explicitly disclosed in the Privacy Policy as never institution-visible, and is optional per the wizard's own copy. | No fields removed — this is functional, disclosed data collection, not scope creep. |
| Keyboard accessibility | ❌ MISSING (partial) → ✅ | Register/login inputs had no `htmlFor`/`id` association at all (label and input were unconnected siblings); several onboarding/business-edit fields the same; add-capability/add-asset mini-forms had no labels at all (placeholder-only). | Added `htmlFor`/`id` pairs throughout (register, login, onboarding wizard's 9 fields, business-edit's `Field`/`TextArea` helpers + business_type select, institution search). Added visually-hidden (`sr-only`) labels to the 8 placeholder-only capability/asset inputs. |
| Unsupported claims | ✅ PASS (existing) + 1 fix | No "100% secure," "guaranteed," "trusted by thousands," etc. anywhere — prior pass already handled this. Found one *functional* honesty issue instead: a "Share Passport" button with zero backend, and a "Download PDF" button with a real backend that was never wired up — both looked clickable but did nothing. | Removed "Share Passport" (nothing to wire it to). Disabled "Download PDF" honestly with "(coming soon)" instead of leaving a silent dead click. |

## Additional bugs found and fixed (outside the checklist, but real)

1. **Generated Business Passport PDF said "Zenzele Business Passport"** — a leftover from this codebase's origin as a sibling Zenzele Holdings project, pre-rebrand. Institutions downloading a business's credential PDF would have seen the wrong company name on the actual document. Fixed to "Sithelo Business Passport" in `supabase/functions/generate-business-passport-pdf/index.ts`.
2. **Notification emails were sent from `notifications@zenzele.co.za`**, a different company's domain, instead of Sithelo's own. This would very likely fail to deliver or land in spam even before the branding problem. Fixed to `notifications@sithelo.co.za` in `supabase/functions/notification-engine/index.ts`, with a comment flagging that the domain needs to be verified in Resend before launch.
3. **PortalShell (every logged-in dashboard — entrepreneur, institution, admin) had no mobile navigation at all.** The sidebar was a fixed 248px column with no responsive fallback, meaning the entire nav was unreachable below the `md` breakpoint. Built `PortalMobileNav.tsx`, matching the existing marketing `MobileNav`'s accessibility pattern (focus trap, Escape-to-close, scroll lock, `aria-expanded`/`aria-controls`).

## Files Changed

- `tailwind.config.ts` — contrast-corrected `ink.500`, `pending`, `champagne`
- `src/app/layout.tsx` — skip-to-content link
- `src/app/globals.css` — no change (tokens only)
- `src/components/ui/PortalShell.tsx` — mobile nav wiring, `aria-current`, contrast fix
- `src/components/ui/PortalMobileNav.tsx` — **new file**
- `src/components/ui/DocumentViewer.tsx` — per-button `aria-label`, `role="alert"` on errors
- `src/components/ui/MarketingChrome.tsx` — footer contrast fix
- `src/components/onboarding/OnboardingWizard.tsx` — label association ×9, `role="group"` for pill clusters, `aria-pressed` on pills, `role="progressbar"` on step indicator, `aria-live` error
- `src/app/register/page.tsx` — label association, `autoComplete`, consent checkbox, honest button label
- `src/app/login/page.tsx` — label association, `autoComplete`, `role="alert"`
- `src/app/entrepreneur/business/edit/page.tsx` — label association (`Field`/`TextArea` helpers + select), `sr-only` labels on 8 inline inputs, `aria-label` on Remove buttons
- `src/app/entrepreneur/opportunities/[id]/page.tsx` — corrected a `<label>` with no associated control to a `<div>`
- `src/app/institution/search/page.tsx` — label association
- `src/app/page.tsx`, `for-entrepreneurs/page.tsx`, `for-institutions/page.tsx` — button label fixes
- `src/app/passport/[id]/page.tsx` — removed dead button, disabled broken one honestly, contrast fix
- `src/app/privacy/page.tsx` — third-party disclosure + cookies section
- `supabase/functions/generate-business-passport-pdf/index.ts` — branding bug fix
- `supabase/functions/notification-engine/index.ts` — sender-domain bug fix
- `id="main-content"` added to every page's `<main>` (14 files) for the skip link

## New Pages

None. No new legal page was needed (no payments, no refund obligations); the
existing Privacy Policy and Terms pages were extended in place instead of
duplicated.

## Third-Party Services Found

| Service | Purpose | Data involved | Status |
|---|---|---|---|
| Supabase | Auth, database, file storage | Everything the app collects | Active, now disclosed in Privacy Policy |
| Resend | Transactional email | Recipient email, name, message content | Active, now disclosed |
| Google Fonts | Typeface delivery via `<link>` | Visitor IP address (standard font-request behaviour) | Active, now disclosed |
| AI provider abstraction (`src/lib/ai`) | Multi-provider LLM wrapper | N/A — not called anywhere in the app yet | Present in code, inactive, noted as "not active" in Privacy Policy |
| WhatsApp Cloud API | Notifications | N/A — env vars present, no implementation wired | Present in code, inactive, noted as "not active" |

## Remaining Human Decisions

- Actual registered business details for the Terms page (`[REGISTRATION DETAILS]`, `[PHYSICAL ADDRESS]`)
- A published support/contact email (currently doesn't exist anywhere, correctly not invented)
- Data retention periods and the POPIA data-subject-rights process (Privacy Policy §6, still placeholder)
- Formal legal review of both Terms and Privacy Policy before launch — this pass improved their accuracy and completeness but did not (and cannot) provide legal sign-off
- Confirm `notifications@sithelo.co.za` as a verified sending domain in Resend
- Decide whether to download/re-host the Unsplash hero images rather than hotlinking them long-term

## Remaining Technical Issues

- "Download PDF" on the passport page is disabled rather than wired up. The backend (`generate-business-passport-pdf`) is real but self-described as a stub (no QR code, no document parity with the in-app design, and — the real blocker — no signed-URL route yet for the private `generated-pdfs` bucket it writes to, mirroring the existing `/api/documents/[id]/signed-url` pattern). Wiring this is a real feature to scope deliberately, not a compliance-audit-scale fix.
- `error.tsx` still has a comment noting no real error-monitoring (e.g. Sentry) is wired up — fine for now since no telemetry currently exists, but worth deciding before launch.
- ESLint couldn't run in this environment (no config file present to invoke `next lint` non-interactively); `tsc --noEmit` and `next build` both pass cleanly instead, which is the stronger check for this change set.
