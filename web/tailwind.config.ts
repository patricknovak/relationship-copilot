import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
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
          950: "#2e1630",
        },
        // Warm apricot — "the other person", celebration, warmth.
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          950: "#431407",
        },
        // Semantic tokens — CSS-variable backed so they flip in dark mode
        // without touching component markup.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--paper) / <alpha-value>)",
          warm: "rgb(var(--paper-warm) / <alpha-value>)",
        },
        // Card surface + hairline; distinct from page paper so cards lift.
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          line: "rgb(var(--surface-line) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["clamp(2.75rem, 7.5vw, 5.25rem)", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.25rem, 5vw, 3.75rem)", { lineHeight: "1.06", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(1.875rem, 3.6vw, 2.75rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(34 26 34 / 0.04), 0 4px 16px rgb(34 26 34 / 0.06)",
        lift: "0 2px 4px rgb(34 26 34 / 0.05), 0 12px 32px rgb(34 26 34 / 0.10)",
        float: "0 8px 24px -8px rgb(34 26 34 / 0.18), 0 24px 56px -16px rgb(80 40 76 / 0.22)",
        glow: "0 0 60px 12px rgb(162 93 157 / 0.15)",
        "brand-glow": "0 10px 30px -10px rgb(116 56 111 / 0.55)",
        inset: "inset 0 1px 0 rgb(255 255 255 / 0.35)",
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
        pop: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "60%": { opacity: "1", transform: "scale(1.03)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        drift: {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(24px, -18px) scale(1.08)" },
          "100%": { transform: "translate(0, 0) scale(1)" },
        },
        unblur: {
          from: { filter: "blur(7px)", opacity: "0.55" },
          to: { filter: "blur(0)", opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        confetti: {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(720deg)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.9s ease both",
        pop: "pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 7s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        unblur: "unblur 1.1s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        confetti: "confetti 2.8s cubic-bezier(0.2, 0.6, 0.4, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
