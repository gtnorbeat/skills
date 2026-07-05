// Build-time version + name constants injected via vite.config.ts
// `define` block (see __APP_VERSION__ / __APP_NAME__ globals below).
// Source of truth: package.json
/*
    "name": "aura-label-manager",
    "version": "1.0.0",
*/
// Bumping the version there propagates to every Footer / About card /
// splash that imports APP_VERSION / APP_NAME in lock-step — no
// manual sync step required.

declare const __APP_VERSION__: string;
declare const __APP_NAME__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

export const APP_NAME: string =
  typeof __APP_NAME__ !== "undefined" ? __APP_NAME__ : "AURA";
