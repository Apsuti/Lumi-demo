import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1E2147",
          soft: "#4A4F7A",
          mute: "#7C81A6",
        },
        sky: {
          50: "#F3F7FF",
          100: "#E6EEFF",
          200: "#CCDDFF",
          300: "#A8C4FF",
          400: "#7FA6FF",
          500: "#5B87F5",
          600: "#4369DB",
        },
        lilac: {
          50: "#F7F4FF",
          100: "#EEE8FF",
          200: "#DDD2FF",
          300: "#C4B3FF",
          400: "#A78BFA",
          500: "#8B6CF0",
          600: "#7253D6",
        },
        mint: { 100: "#E3F7EF", 400: "#5CC9A0", 600: "#2E9C74" },
        peach: { 100: "#FFF0E8", 400: "#FFAB85" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(30,33,71,0.04), 0 8px 24px -8px rgba(30,33,71,0.10)",
        lift: "0 2px 4px rgba(30,33,71,0.04), 0 24px 48px -16px rgba(67,105,219,0.22)",
        glow: "0 0 0 1px rgba(167,139,250,0.15), 0 20px 60px -20px rgba(139,108,240,0.45)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
