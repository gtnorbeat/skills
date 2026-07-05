import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read package.json once at build start so __APP_VERSION__ / __APP_NAME__
// stay in lock-step with `npm version patch`. No manual sync: every
// module that imports from "@/utils/version" picks up the literal
// "1.0.0" string at vite build time.
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
);

/**
 * Vite plugin that injects a build-time version string into the
 * service worker's CACHE_VERSION constant. On every build the git
 * commit hash (or a timestamp fallback) is substituted so the SW
 * cache is automatically invalidated when a new deploy ships — no
 * manual version bumps required.
 *
 * Mechanism: after Vite copies public/sw.js to the output directory,
 * closeBundle reads the emitted file, replaces `aura-shell-*` with a
 * commit-hash-prefixed version, and writes it back before the build
 * runner reads the artifact. This keeps sw.js as a plain static file
 * during development while still producing a version-unique SW for
 * production deploys.
 */
function swCacheVersionPlugin(): Plugin {
  const SW_FILENAME = "sw.js";
  let outDir = "dist";
  let cacheVersion = `aura-shell-${Date.now()}`;

  return {
    name: "sw-cache-version",
    apply: "build",

    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir || "dist");
    },

    buildStart() {
      try {
        const rev = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
        cacheVersion = `aura-shell-${rev}`;
      } catch {
        // git not available — timestamp fallback ensures at least per-build uniqueness
        cacheVersion = `aura-shell-${Date.now()}`;
      }
    },

    writeBundle() {
      const swPath = path.join(outDir, SW_FILENAME);
      if (!existsSync(swPath)) return;
      const content = readFileSync(swPath, "utf8");
      const updated = content.replace(/aura-shell-[a-zA-Z0-9]+/g, cacheVersion);
      if (updated !== content) {
        writeFileSync(swPath, updated, "utf8");
      }
    },
  };
}

export default defineConfig({
  // Build-time version+name injection. Vite performs a literal
  // substitution at build time so importing APP_VERSION from
  // "@/utils/version" lands the string "1.0.0" into the bundle
  // with zero runtime indirection. Bumping package.json propagates
  // through vite.config.ts → vite `define` → every Footer / About
  // card / splash that imports the constants.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify("A&R Utility & Resources AI Assistant"),
  },
  plugins: [tailwindcss(), react(), swCacheVersionPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  // Dependency pre-bundling must use the same modern target as the
  // production build. react-router v7 ships ESM with destructuring
  // patterns that Vite's default (conservative) esbuild targets
  // (chrome87, edge88, es2020, …) can't yet transform — matching
  // optimizeDeps to the build target avoids 289 spurious esbuild
  // errors on dev server start.
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
  // Route-level code splitting (React.lazy + Suspense in App.tsx +
  // AppLayout.tsx + Dashboard.tsx) is paired here with explicit vendor
  // chunks so the Dashboard-first landing payload drops to one React +
  // one router chunk plus only the route entered. es2022 lets the
  // compiler drop legacy polyfills we don't need for the current
  // evergreen baseline (~5-15 KB off the main bundle).
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-dom/client"],
          router: ["react-router", "react-router-dom"],
        },
      },
    },
  },
});
