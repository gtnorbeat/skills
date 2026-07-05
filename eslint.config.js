// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // Global ignores — coverage reports, generated bundles (wrangler at any depth), infra tooling, etc.
  { ignores: ["reproduction/", "**/vitest.config.ts", "dist/", "**/dist/", "node_modules/", "packages/*/dist/", "**/.wrangler/**", "coverage/", "drizzle/", "**/drizzle.config.ts", "*.test.js", ".agents/", ".nx/", ".claude/", "infra/", "packages/*/tests/", "apps/*/tests/"] },

  // Enable type-aware linting via projectService — only for TS source files.
  // JS/JSX/test/generated files don't belong to any tsconfig and would produce
  // spurious "file not found by the project service" parsing errors.
  {
    files: ["packages/**/*.ts", "apps/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Require async functions to handle promises properly (type-aware)
      "@typescript-eslint/no-floating-promises": "error",
    },
  },

  // Base: JS/TS recommended rules
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // -- Generic JS/TS rules for all source files --
  {
    files: ["packages/**/*.ts", "apps/**/*.ts"],
    languageOptions: {
      // Node.js + ES2023 globals (process, URL, console, setTimeout, etc.)
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      // Allow console.log for CLI output
      "no-console": "off",

      // Prefer const over let when possible
      "prefer-const": "warn",

      // No unused vars (error, but allow underscore-prefixed)
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      // No explicit any — we want proper types
      "@typescript-eslint/no-explicit-any": "warn",

      // No require() imports — we use ESM
      "@typescript-eslint/no-var-requires": "error",

      // Type inference is preferred over unnecessary type annotations
      "@typescript-eslint/no-inferrable-types": "warn",

      // Ban explicit Array<any> — use proper generics
      "@typescript-eslint/no-array-constructor": "error",
    },
  },

  // -- Cloudflare Workers — allow some patterns --
  {
    files: ["apps/**/*.ts"],
    rules: {
      // Workers use global types (e.g. Request, Response, Env)
      "no-undef": "off",
    },
  },

  // -- Service Worker — uses browser SW globals (self, caches, etc.) --
  {
    files: ["apps/auralabels/public/sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
    rules: {
      "no-restricted-globals": "off",
    },
  },

  // -- Node.js scripts (.mjs) --
  {
    files: ["apps/**/scripts/**/*.mjs", "packages/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
  },

);
