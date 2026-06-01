/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1D2524",
        graphite: "#4D5A58",
        mist: "#F5F7F7",
        line: "#E4EAEA",
        teal: "#0F766E",
        blue: "#2563EB"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(29, 37, 36, 0.08)",
        lift: "0 10px 28px rgba(29, 37, 36, 0.10)"
      }
    }
  },
  plugins: []
};
