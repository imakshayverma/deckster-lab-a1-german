module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101014",
        linen: "#f6f1e9",
        clay: "#e7d9c8",
        moss: "#7c8b6f",
        ember: "#d66a4c",
        sky: "#b8c3d9"
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        sans: ["Lato", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 60px rgba(16,16,20,0.15)",
        card: "0 12px 32px rgba(16,16,20,0.18)"
      },
      borderRadius: {
        xl: "1.25rem"
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        }
      },
      animation: {
        floatIn: "floatIn 0.6s ease-out"
      }
    }
  },
  plugins: []
};
