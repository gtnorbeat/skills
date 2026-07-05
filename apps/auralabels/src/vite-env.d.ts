/// <reference types="vite/client" />

// Augment Vite's ImportMetaEnv interface with our custom env vars.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMetaEnv {
  /** hCaptcha site key — public, used by the registration form widget. */
  readonly VITE_HCAPTCHA_SITEKEY?: string;
}

export {};
