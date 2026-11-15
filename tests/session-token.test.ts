import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "../src/lib/session-token";

const key = new TextEncoder().encode("test-secret-test-secret-123456");
const otherKey = new TextEncoder().encode("another-secret-another-secret-9");

describe("session tokens", () => {
  it("round-trips a user id", async () => {
    const token = await signSessionToken("user-1", key);
    expect(await verifySessionToken(token, key)).toBe("user-1");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSessionToken("user-1", otherKey);
    expect(await verifySessionToken(token, key)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    expect(await verifySessionToken(expired, key)).toBeNull();
  });

  it("accepts a token that has not expired yet", async () => {
    const token = await signSessionToken("user-1", key, 60);
    expect(await verifySessionToken(token, key)).toBe("user-1");
  });

  it("rejects a tampered token", async () => {
    const token = await signSessionToken("user-1", key);
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "admin", exp: 9999999999 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`, key)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.${s}x`, key)).toBeNull();
  });

  it("rejects malformed input", async () => {
    for (const bad of ["", "abc", "a.b", "a.b.c", "not a jwt at all"]) {
      expect(await verifySessionToken(bad, key)).toBeNull();
    }
  });

  it("rejects an unsigned (alg none) token", async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${enc({ alg: "none", typ: "JWT" })}.${enc({ sub: "user-1", exp: 9999999999 })}.`;
    expect(await verifySessionToken(none, key)).toBeNull();
  });

  it("rejects a token signed with a different HMAC algorithm", async () => {
    const hs512 = await new SignJWT({})
      .setProtectedHeader({ alg: "HS512" })
      .setSubject("user-1")
      .setExpirationTime("60s")
      .sign(key);
    expect(await verifySessionToken(hs512, key)).toBeNull();
  });

  it("rejects a valid token that has no subject", async () => {
    const noSub = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setExpirationTime("60s").sign(key);
    expect(await verifySessionToken(noSub, key)).toBeNull();
  });
});
