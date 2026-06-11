import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm mulberry — intimate and grown-up, kept clearly distinct from
        // the rose used for safety surfaces.
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
        ink: {
          DEFAULT: "#221a22",
          soft: "#4a3f49",
        },
        paper: {
          DEFAULT: "#fbf8f4",
          warm: "#f6efe7",
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
