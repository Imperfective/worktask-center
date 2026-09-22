import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans KR"', '"Apple SD Gothic Neo"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
