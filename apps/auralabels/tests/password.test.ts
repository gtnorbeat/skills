import { describe, it, expect } from "vitest";
import { generatePassword } from "@/utils/password";

describe("generatePassword", () => {
  it("returns exactly 12 characters", () => {
    const pwd = generatePassword();
    expect(pwd.length).toBe(12);
  });

  it("contains only base64url-safe characters (no +, /, or =)", () => {
    // Run 20 samples to catch any fluke char.
    for (let i = 0; i < 20; i++) {
      const pwd = generatePassword();
      expect(pwd).not.toMatch(/[+/=]/);
    }
  });

  it("produces different passwords on successive calls", () => {
    // Crypto CSPRNG — vanishingly unlikely to collide across 10 calls.
    const set = new Set<string>();
    for (let i = 0; i < 10; i++) {
      set.add(generatePassword());
    }
    expect(set.size).toBe(10);
  });

  it("is well above the 8-char server minimum", () => {
    // btoa + /[+/=]/ removal can yield 10-12 chars from 9 random bytes.
    // The server minimum is 8 — verify we always exceed it.
    for (let i = 0; i < 20; i++) {
      const pwd = generatePassword();
      expect(pwd.length).toBeGreaterThanOrEqual(8);
    }
  });
});
