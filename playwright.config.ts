import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3100",
    headless: true,
  },
  webServer: process.env.E2E_EXTERNAL_SERVER
    ? undefined
    : [
        {
          command: "npm --prefix server run dev",
          url: "http://127.0.0.1:4100/api/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: "npm --prefix client run dev",
          url: "http://localhost:3100",
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      ],
});
