import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ---- Sithelo core palette ----
        navy: { DEFAULT: "#0B1D33", 900: "#081625", 800: "#0B1D33", 700: "#12294A" },
        blue: { DEFAULT: "#1B4B8F", 600: "#1B4B8F", 700: "#153B70" },
        electric: "#2F7BF6",
        charcoal: "#181B20",
        // ink-500 darkened from the original #7A8190 (3.9:1 on white — fails
        // WCAG AA for the small-text form labels and eyebrows it's used for)
        // to #687080 (~5.0:1 on white / ~4.6:1 on ivory). Same hue, same
        // family relationship to ink-600, just dark enough to pass at 12px.
        ink: { 900: "#181B20", 700: "#3D434C", 600: "#5B6270", 500: "#687080" },
        ivory: "#F7F5F0",
        grey: { 50: "#F4F5F6", 100: "#E9EBEE", 200: "#D8DBE0", 300: "#B9BEC7" },
        line: "#E3E1DA",
        verified: "#1E7A5F",
        // pending darkened from #B07A2E (3.7:1 on white — fails AA for the
        // badge-pending text it's used for) to #8F5D1B (~5.6:1 on white).
        // Same gold/amber family, just enough contrast at badge text size.
        pending: "#8F5D1B",
        // ---- Sithelo 2.0 public-site palette (Warm African Editorial) ----
        // Used by the marketing pages only; the signed-in app keeps the
        // navy/ivory tokens above. Contrast (WCAG 2.2) was checked per pair:
        //  - midnight on linen 13.3:1, on paper 15.1:1
        //  - copper #B47C54 is 2.9:1 on linen: rules, accents and large
        //    display only. Small copper text uses copper-ink (5.1:1 on
        //    linen). On midnight, copper itself passes (4.5:1).
        //  - olive is decorative only (3.5:1); olive-ink for any text.
        midnight: { DEFAULT: "#102333", 800: "#0C1B28", 700: "#183247" },
        linen: { DEFAULT: "#EEE9DF", deep: "#E4DDD0" },
        paper: "#FAF8F3",
        copper: { DEFAULT: "#B47C54", ink: "#8A5530", light: "#D4A27C" },
        olive: { DEFAULT: "#777F65", ink: "#5A6149" },
        // ---- Legacy token aliases ----
        // The rest of the app (dashboards, passport, admin) still references
        // these class names. Aliasing them to the new palette means every
        // existing screen inherits the Sithelo navy/blue/electric system
        // immediately, without a file-by-file rewrite. Do not add new usages
        // of these names — use the tokens above instead.
        sky: { DEFAULT: "#2F7BF6", deep: "#2F7BF6" },
        cobalt: "#1B4B8F",
        teal: "#1E7A5F",
        champagne: "#8F5D1B",
        soft: "#F7F5F0",
      },
      fontFamily: {
        display: ["'Fraunces Variable'", "'Fraunces'", "Georgia", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["clamp(2.5rem, 5vw, 4.25rem)", { lineHeight: "1.04", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2rem, 3.4vw, 3rem)", { lineHeight: "1.08", letterSpacing: "-0.01em" }],
        eyebrow: ["0.75rem", { lineHeight: "1", letterSpacing: "0.14em" }],
        // Public-site scale. Hero: ~38px at 320–390, 72px from ~1360.
        // Section: ~30px on phones, ~52px on desktop. Lead: 17–19px.
        "m-hero": ["clamp(2.375rem, 1.2rem + 4vw, 4.5rem)", { lineHeight: "1.02", letterSpacing: "-0.022em" }],
        "m-section": ["clamp(1.875rem, 1.1rem + 2.6vw, 3.25rem)", { lineHeight: "1.06", letterSpacing: "-0.015em" }],
        "m-title": ["clamp(1.375rem, 1.05rem + 0.9vw, 1.75rem)", { lineHeight: "1.18", letterSpacing: "-0.01em" }],
        "m-lead": ["clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)", { lineHeight: "1.6" }],
      },
      borderRadius: { sm: "3px", DEFAULT: "4px", card: "6px", pill: "999px" },
      transitionTimingFunction: {
        // The easing used across both motion-skill references (WAAPI +
        // CSS): a snappy, no-overshoot expo-out. One named token so every
        // hover/reveal in the app shares the same feel instead of each
        // component inventing its own curve.
        brand: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        edge: "0 1px 0 rgba(11,29,51,0.06)",
        lift: "0 18px 40px -20px rgba(8,22,37,0.35)",
        // legacy aliases — see color note above
        float: "0 1px 0 rgba(11,29,51,0.06)",
        glow: "0 18px 40px -20px rgba(8,22,37,0.45)",
      },
      backgroundImage: {
        "fade-navy-b": "linear-gradient(180deg, rgba(8,22,37,0) 0%, rgba(8,22,37,0.92) 100%)",
        "fade-navy-t": "linear-gradient(0deg, rgba(8,22,37,0) 0%, rgba(8,22,37,0.85) 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
