import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx vite --port 5173 --host 127.0.0.1",
    port: 5173,
    cwd: new URL(".", import.meta.url).pathname,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // CDP Emulation API (used by page.emulateMedia) requires
        // full Chromium, not a stripped-down test runner.
        launchOptions: {
          channel: undefined,
        },
      },
    },
  ],
});
