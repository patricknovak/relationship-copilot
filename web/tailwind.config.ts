import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mulberry accent ramp — fixed across themes (buttons, links stay
        // mulberry in both light and dark).
        brand: {
          50: "#faf5fa",
          100: "#f4e9f3",
          200: "#e8d2e6",
          300: "#d4add1",
          400: "#bb7fb6",
          500: "#a25d9d",
          600: "#8b4486",
          700: "#74386f",
          800: "#5f2f5b",
          900: "#50284c",
        },
        // Semantic tokens — CSS-variable backed so they flip in dark mode
        // without touching component markup.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--paper) / <alpha-value>)",
          warm: "rgb(var(--paper-warm) / <alpha-value>)",
        },
        // Card surface + hairline; distinct from page paper so cards lift.
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          line: "rgb(var(--surface-line) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(34 26 34 / 0.04), 0 4px 16px rgb(34 26 34 / 0.06)",
        lift: "0 2px 4px rgb(34 26 34 / 0.05), 0 12px 32px rgb(34 26 34 / 0.10)",
        glow: "0 0 60px 12px rgb(162 93 157 / 0.15)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.9s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
