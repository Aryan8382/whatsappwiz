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
        g: {
          50:  "#f0fdf6",
          100: "#dcfce9",
          200: "#bbf7d2",
          300: "#86efad",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont",
          '"SF Pro Display"', '"SF Pro Text"',
          '"Helvetica Neue"', "Arial", "sans-serif",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.75rem",
        "5xl": "2rem",
      },
      boxShadow: {
        /* macOS-style layered shadows */
        "glass-sm":  "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)",
        "glass-md":  "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)",
        "glass-lg":  "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)",
        "glass-xl":  "0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.85)",
        "green-glow":"0 4px 20px rgba(34,197,94,0.30)",
        "green-lg":  "0 8px 32px rgba(22,163,74,0.35)",
        "float":     "0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)",
      },
      backdropBlur: {
        xs:  "4px",
        sm:  "8px",
        md:  "16px",
        lg:  "24px",
        xl:  "40px",
        "2xl":"60px",
        "3xl":"80px",
      },
      animation: {
        "fade-in":   "fadeIn 0.25s ease-out",
        "slide-up":  "slideUp 0.30s cubic-bezier(0.16,1,0.3,1)",
        "scale-in":  "scaleIn 0.22s cubic-bezier(0.16,1,0.3,1)",
        "shimmer":   "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity:"0" }, to: { opacity:"1" } },
        slideUp:  { from: { opacity:"0", transform:"translateY(10px)" }, to: { opacity:"1", transform:"translateY(0)" } },
        scaleIn:  { from: { opacity:"0", transform:"scale(0.96)" }, to: { opacity:"1", transform:"scale(1)" } },
        shimmer:  { from: { backgroundPosition:"-200% 0" }, to: { backgroundPosition:"200% 0" } },
      },
    },
  },
  plugins: [],
};
export default config;
