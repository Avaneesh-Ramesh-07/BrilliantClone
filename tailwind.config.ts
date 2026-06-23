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
