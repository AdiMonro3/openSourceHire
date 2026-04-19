import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#f5f5f7",
          raised: "#ffffff",
          muted: "#f8f8fa",
          border: "#e6e6ea",
          hover: "#fafafc",
        },
        accent: {
          DEFAULT: "#7c3aed",
          soft: "#ede9fe",
          ring: "rgba(124, 58, 237, 0.35)",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 15, 20, 0.04), 0 1px 1px rgba(15, 15, 20, 0.03)",
        glow: "0 0 0 1px rgba(124, 58, 237, 0.35), 0 8px 32px -8px rgba(124, 58, 237, 0.45)",
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
        "title-gradient":
          "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)",
        "grid-faint":
          "radial-gradient(circle at 1px 1px, rgba(15, 15, 20, 0.06) 1px, transparent 0)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out both",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
