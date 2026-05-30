import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@scada/domain": fileURLToPath(new URL("../../packages/domain/src/index.ts", import.meta.url))
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:4100",
      "/socket.io": {
        target: "http://localhost:4100",
        ws: true
      }
    }
  }
});
