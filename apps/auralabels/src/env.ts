/**
 * Environment bindings for the Auralabels Worker.
 *
 * Secrets set via `wrangler secret put` in production,
 * or `.dev.vars` for local development.
 */

/** Stub for Cloudflare R2Bucket type — avoids pulling in @cloudflare/workers-types globally. */
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
  list(options?: { limit?: number; cursor?: string }): Promise<R2Objects>;
}

interface R2PutOptions {
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

interface R2Object {
  key: string;
  size: number;
  httpEtag: string;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
  body: ReadableStream;
}

/** Stub for Cloudflare Workers ScheduledController. */
export interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

/** Stub for Cloudflare Email Service SendEmail binding. */
interface SendEmail {
  send(msg: {
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void>;
}

/** Stub for Cloudflare Workers AI binding — avoids pulling in @cloudflare/workers-types globally. */
interface Ai {
  run(model: string, options: Record<string, unknown>): Promise<Record<string, unknown>>;
  run(model: string, options: { stream: true } & Record<string, unknown>): Promise<ReadableStream>;
}

export interface Env {
  /** JWT signing secret (HS256). */
  JWT_SECRET?: string;

  /** Neon Postgres connection string. */
  DATABASE_URL?: string;

  /** R2 bucket for file storage (artwork, contracts, demos). */
  R2_BUCKET?: R2Bucket;

  /** Bootstrap admin credentials (used on first run when users table is empty). */
  BOOTSTRAP_ADMIN_USERNAME?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;

  /** Webhook HMAC secret (Make.com integration). */
  WEBHOOK_SECRET?: string;

  /** hCaptcha secret key — verifies tokens server-side for registration. */
  HCAPTCHA_SECRET_KEY?: string;

  /** Workers AI binding — in-house text generation (always-on fallback). */
  AI?: Ai;

  /** OpenRouter API key — primary AI provider (Llama 3.3 70B free tier). */
  OPENROUTER_API_KEY?: string;

  /** Email Service binding — send outgoing emails. */
  SEND_EMAIL?: SendEmail;

}
