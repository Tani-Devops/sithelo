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
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["clamp(2.5rem, 5vw, 4.25rem)", { lineHeight: "1.04", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2rem, 3.4vw, 3rem)", { lineHeight: "1.08", letterSpacing: "-0.01em" }],
        eyebrow: ["0.75rem", { lineHeight: "1", letterSpacing: "0.14em" }],
      },
      borderRadius: { sm: "3px", DEFAULT: "4px", card: "6px", pill: "999px" },
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
