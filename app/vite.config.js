import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy: { "/api": { target: "http://localhost:8787", ws: true } } },
  build: { chunkSizeWarningLimit: 1600 },
});
