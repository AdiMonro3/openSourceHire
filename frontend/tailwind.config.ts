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
          DEFAULT: "#0A0A0B",
          raised: "#131316",
          muted: "#17171B",
          hover: "#1C1C20",
          border: "rgba(255, 255, 255, 0.08)",
          "border-strong": "rgba(255, 255, 255, 0.14)",
        },
        ink: {
          DEFAULT: "#F5F5F7",
          muted: "#9A9AA3",
          subtle: "#6B6B74",
          faint: "#4A4A52",
        },
        accent: {
          DEFAULT: "#A78BFA",
          strong: "#8B5CF6",
          soft: "rgba(167, 139, 250, 0.12)",
          ring: "rgba(167, 139, 250, 0.45)",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 8px 24px -12px rgba(0, 0, 0, 0.6)",
        "card-hover":
          "0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 16px 40px -12px rgba(0, 0, 0, 0.7)",
        glow: "0 0 0 1px rgba(167, 139, 250, 0.35), 0 8px 32px -8px rgba(139, 92, 246, 0.55)",
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
        "title-gradient":
          "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 40%, #f0abfc 100%)",
        "grid-faint":
          "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)",
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
