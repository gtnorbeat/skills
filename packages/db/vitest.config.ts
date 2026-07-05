import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Database operations can be slow on first connection
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Probe test DB before loading test modules so itDb/itDb
    // fixtures skip correctly when the DB is unreachable.
    globalSetup: ["./tests/global-setup.ts"],
  },
});
