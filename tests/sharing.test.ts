import { describe, expect, it } from "vitest";
import { checkShareTarget } from "../src/lib/shareRules";

const ownerId = "u-alice";

describe("checkShareTarget", () => {
  it("allows sharing with another user", () => {
    expect(checkShareTarget({ ownerId, actorId: ownerId, targetUserId: "u-bob" })).toEqual({ ok: true });
  });

  it("rejects sharing with yourself", () => {
    const r = checkShareTarget({ ownerId, actorId: ownerId, targetUserId: ownerId });
    expect(r).toEqual({ ok: false, status: 400, error: "You can't share a document with yourself" });
  });

  it("rejects sharing with the owner when someone else is acting", () => {
    const r = checkShareTarget({ ownerId, actorId: "u-admin", targetUserId: ownerId });
    expect(r).toEqual({ ok: false, status: 400, error: "The owner already has full access" });
  });

  it("reports self-share first when actor, owner and target are the same", () => {
    const r = checkShareTarget({ ownerId, actorId: ownerId, targetUserId: ownerId });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/yourself/);
  });
});
