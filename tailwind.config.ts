import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        night: "#0b1026",
        cyber: "#6c4cff",
        neon: "#00ffc8"
      }
    }
  },
  plugins: []
};

export default config;
