// Pure JWT helpers (jose only: no cookies, no database), so they are unit-testable.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function signSessionToken(
  userId: string,
  key: Uint8Array,
  expiresInSeconds: number = SESSION_SECONDS,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(key);
}

/** Returns the user id from a valid token, or null for anything invalid (bad signature, expired, malformed). */
export async function verifySessionToken(token: string, key: Uint8Array): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
