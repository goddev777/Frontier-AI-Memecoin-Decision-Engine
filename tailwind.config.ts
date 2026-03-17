import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        panel: "var(--panel)",
        ink: "var(--ink)",
        mute: "var(--mute)",
        line: "var(--line)",
        lime: "var(--lime)",
        ember: "var(--ember)",
        cyan: "var(--cyan)"
      },
      boxShadow: {
        panel: "0 20px 80px rgba(0, 0, 0, 0.38)",
        glow: "0 0 0 1px rgba(152, 255, 109, 0.18), 0 20px 60px rgba(152, 255, 109, 0.08)"
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)"
      },
      backgroundImage: {
        "terminal-grid": "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
