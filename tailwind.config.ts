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
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: {
          DEFAULT: "#17171C",
          soft: "#232329",
        },
        accent: {
          DEFAULT: "#F4633A",
          dark: "#E14F27",
          light: "#FEEBE3",
        },
        success: {
          DEFAULT: "#22A559",
          light: "#E3F6EA",
        },
        danger: {
          DEFAULT: "#E5484D",
          light: "#FDE7E7",
        },
        warn: {
          DEFAULT: "#D97706",
          light: "#FEF3E2",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
