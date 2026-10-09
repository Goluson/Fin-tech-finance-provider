/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2f7",
          100: "#d4dfec",
          200: "#a9bfd9",
          300: "#7e9fc6",
          400: "#53809f",
          500: "#365f7d",
          600: "#284862",
          700: "#1c3448",
          800: "#12233350",
          900: "#0b1626",
          950: "#060d16",
        },
        brandgreen: {
          50: "#eafaf1",
          100: "#c9f0da",
          200: "#93e0b6",
          300: "#5dcf92",
          400: "#2fbb75",
          500: "#1f9e5f",
          600: "#187d4b",
          700: "#135f3a",
          800: "#0d4129",
          900: "#082718",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
