// Session helpers: sign/verify JWT, httpOnly cookie, current user
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_SECONDS, signSessionToken, verifySessionToken } from "@/lib/session-token";

export const SESSION_COOKIE = "draftly_session";

function getKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await signSessionToken(userId, getKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export type CurrentUser = { id: string; email: string; name: string };

/**
 * Reads and verifies the session cookie. Returns null when there is no cookie, the token is
 * invalid or expired, or the user no longer exists. Database errors are NOT caught here: they
 * propagate so Next shows the error page instead of silently treating the user as signed out.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token, getKey()); // only token problems become null
  if (!userId) return null;

  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}
