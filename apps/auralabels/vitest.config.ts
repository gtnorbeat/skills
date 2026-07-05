import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    // Default to node environment for auth/deriveFailureMode/password
    // tests — avoids the jsdom cross-realm Uint8Array issue that
    // breaks jose's `instanceof Uint8Array` check on the key material.
    // api.test.ts uses `// @vitest-environment jsdom` in its header.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/utils/**", "src/auth.ts"],
    },
  },
});
