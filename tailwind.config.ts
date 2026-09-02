import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sky: { DEFAULT: "#67C7F2", deep: "#3AAFE3" },
        cobalt: "#3157D5",
        navy: "#10243E",
        teal: "#159A9C",
        ivory: "#F8F5ED",
        champagne: "#D9C39A",
        soft: "#F4F8FA",
        charcoal: "#18212B",
        ink: { 900: "#18212B", 600: "#5B6673" },
        line: "#E4E7EA",
      },
      fontFamily: {
        display: ["Manrope", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "16px" },
      boxShadow: {
        float: "0 1px 2px rgba(16,36,62,0.04), 0 12px 32px -12px rgba(16,36,62,0.14)",
        glow: "0 0 0 1px rgba(103,199,242,0.25), 0 8px 40px -8px rgba(58,175,227,0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
