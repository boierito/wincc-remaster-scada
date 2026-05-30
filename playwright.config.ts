import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173"
  },
  webServer: [
    {
      command: "npm --workspace services/api run dev",
      port: 4100,
      reuseExistingServer: true
    },
    {
      command: "npm --workspace apps/engineering run dev",
      port: 5173,
      reuseExistingServer: true
    }
  ]
});
