import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: "#faf6f1",
          100: "#f2e9df",
          200: "#e4d1bd",
          300: "#d3b294",
          400: "#bf8e6a",
          500: "#b0764f",
          600: "#9a6043",
          700: "#7f4b39",
          800: "#693e33",
          900: "#59362e",
          950: "#301a16",
        },
        cream: "#fbf7f2",
        accent: {
          DEFAULT: "#e0703c",
          dark: "#c45a2b",
        },
      },
      fontFamily: {
        // Stack tipográfica do Atlassian/Bitbucket
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Oxygen",
          "Ubuntu",
          '"Fira Sans"',
          '"Droid Sans"',
          '"Helvetica Neue"',
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(89, 54, 46, 0.25)",
        card: "0 2px 16px -6px rgba(89, 54, 46, 0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        steam: {
          "0%": { opacity: "0", transform: "translateY(0) scaleX(1)" },
          "50%": { opacity: "0.6" },
          "100%": { opacity: "0", transform: "translateY(-10px) scaleX(1.4)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "15%": { transform: "rotate(-16deg) scale(1.15)" },
          "30%": { transform: "rotate(14deg) scale(1.15)" },
          "45%": { transform: "rotate(-10deg)" },
          "60%": { transform: "rotate(8deg)" },
          "75%": { transform: "rotate(-4deg)" },
        },
        "badge-pop": {
          "0%": { transform: "scale(0)" },
          "60%": { transform: "scale(1.25)" },
          "100%": { transform: "scale(1)" },
        },
        "reaction-pop": {
          "0%": { opacity: "0", transform: "scale(0.7) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
        steam: "steam 2.5s ease-in-out infinite",
        wiggle: "wiggle 0.7s ease-in-out",
        "badge-pop": "badge-pop 0.3s ease-out",
        "reaction-pop": "reaction-pop 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.3)",
      },
    },
  },
  plugins: [],
};

export default config;
