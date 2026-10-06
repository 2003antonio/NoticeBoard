import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 plugs straight into Vite, so there is no separate PostCSS config.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 }, // the port the backend already allows via CORS
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    css: true,
  },
});
