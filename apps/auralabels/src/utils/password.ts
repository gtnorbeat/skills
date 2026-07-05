/**
 * Shared temp-credential generator for admin invite flows.
 *
 * Exactly 12 chars from a base64url alphabet (A-Z, a-z, 0-9, -,
 * _). Each byte from the CSPRNG maps to a character via modulo —
 * the output is always 12 chars, comfortably above the 8-char server
 * minimum, and safe to paste into a chat DM without URL-encoding.
 *
 * Used by both invite surfaces — keep them identical so admins see
 * the same key length regardless of which path they clicked from:
 *   - src/components/settings/SettingsPage.tsx
 *       TeamAccessPanel's "Invite operator" modal.
 *   - src/components/settings/BetaApplicationsPanel.tsx
 *       Approve & Invite shortcut on a pending row.
 *
 * If you change the format (length, alphabet, etc.), update both
 * call sites in the SAME commit so the password surface stays
 * uniform across the two settings-side flows.
 */
export function generatePassword(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}
