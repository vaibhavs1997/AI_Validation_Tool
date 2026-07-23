import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend server runs on port 4173 (from config.js)
const BACKEND_PORT = 4173;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});