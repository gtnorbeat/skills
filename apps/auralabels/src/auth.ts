/**
 * JWT auth helpers using `jose` (Web Crypto API).
 *
 * Replaces the Node.js `jsonwebtoken` package which relies on
 * Node's crypto module and doesn't work in Cloudflare Workers.
 * jose uses the standard Web Crypto API available in Workers.
 */
import { SignJWT, jwtVerify } from "jose";

/**
 * JWT payload carried in every token.
 */
export interface JwtPayload {
  username: string;
  role?: "admin" | "user";
  tenantId?: string | null;
}

/**
 * Convert a UTF-8 secret string to a CryptoKey for HS256 signing.
 * The key is derived from the secret bytes.
 */
function secretToKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT with the given payload and secret.
 * @param expiry Token expiry string (e.g. "5m", "7d", "2h"). Default: "7d".
 * Returns the compact JWS string.
 */
export async function signToken(
  payload: JwtPayload,
  secret: string,
  expiry = "7d",
): Promise<string> {
  const key = secretToKey(secret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiry)
    .sign(key);
}

/**
 * Verify a JWT and return the decoded payload.
 * Returns null if the token is invalid, expired, or malformed.
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  try {
    const key = secretToKey(secret);
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify a Bearer token from the Authorization header.
 * Returns the decoded payload, or null if missing/invalid.
 */
export async function authenticateRequest(
  req: Request,
  secret: string,
): Promise<JwtPayload | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return verifyToken(token, secret);
}

/**
 * Check whether a path is public (no auth required).
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/webhook") ||
    pathname === "/api/health" ||
    pathname === "/api/login" ||
    pathname === "/api/register" ||
    pathname === "/api/_health/live" ||
    pathname === "/api/beta-applications"
  );
}
