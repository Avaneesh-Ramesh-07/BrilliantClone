import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        primary: "var(--color-primary)",
        "primary-light": "var(--color-primary-light)",
        success: "var(--color-success)",
        error: "var(--color-error)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        "accent-green": "var(--color-accent-green)",
        "accent-yellow": "var(--color-accent-yellow)",
        "accent-purple": "var(--color-accent-purple)",
        "accent-pink": "var(--color-accent-pink)",
        "accent-orange": "var(--color-accent-orange)",
        "accent-cyan": "var(--color-accent-cyan)",
      },
      fontFamily: {
        heading: ["var(--font-dm-sans)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        equation: ["var(--font-dm-mono)", "monospace"],
      },
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
