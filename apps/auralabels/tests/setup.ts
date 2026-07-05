/**
 * Vitest setup file — runs before every test file.
 *
 * Mocks localStorage for the jsdom environment. jsdom provides
 * a real localStorage in recent versions, but vitest's jsdom
 * integration sometimes surfaces it as unavailable (experimental
 * warning). This shim guarantees it's always present.
 *
 * Also provides a global location with an origin so MSW's Node.js
 * interceptor can resolve relative fetch URLs like /api/login —
 * Node has no base URL natively, so fetch("/api/login") throws
 * ERR_INVALID_URL without a location.origin to resolve against.
 */
import { vi } from "vitest";

// MSW Node.js interceptor needs a base URL to resolve relative fetch URLs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.location = { href: "http://localhost:3000", origin: "http://localhost:3000" } as any;

const store = new Map<string, string>();

const localStorageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
  get length() {
    return store.size;
  },
  key: (index: number) => {
    const keys = [...store.keys()];
    return keys[index] ?? null;
  },
};

vi.stubGlobal("localStorage", localStorageMock);
