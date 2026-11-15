import { describe, expect, it } from "vitest";
import {
  canEdit,
  canManage,
  canView,
  decideAccess,
  getAccess,
  type Access,
  type AccessDoc,
  type AccessShare,
} from "../src/lib/access";

const owner = { id: "u-owner" };
const bob = { id: "u-bob" };
const carol = { id: "u-carol" };
const stranger = { id: "u-stranger" };

const doc: AccessDoc = { id: "d1", ownerId: owner.id };
const shares: AccessShare[] = [
  { userId: bob.id, documentId: "d1", role: "EDITOR" },
  { userId: carol.id, documentId: "d1", role: "VIEWER" },
];

describe("getAccess", () => {
  it("owner", () => {
    expect(getAccess(owner, doc, shares)).toBe("owner");
  });

  it("editor via share", () => {
    expect(getAccess(bob, doc, shares)).toBe("editor");
  });

  it("viewer via share", () => {
    expect(getAccess(carol, doc, shares)).toBe("viewer");
  });

  it("stranger with no share", () => {
    expect(getAccess(stranger, doc, shares)).toBe("none");
  });

  it("signed-out user (null)", () => {
    expect(getAccess(null, doc, shares)).toBe("none");
  });

  it("ignores a share for a different document", () => {
    const other: AccessShare[] = [{ userId: stranger.id, documentId: "d2", role: "EDITOR" }];
    expect(getAccess(stranger, doc, other)).toBe("none");
  });

  it("ignores another user's share", () => {
    expect(getAccess(stranger, doc, [{ userId: bob.id, documentId: "d1", role: "EDITOR" }])).toBe(
      "none",
    );
  });

  it("owner who also has a share row still resolves to owner", () => {
    const withOwnerShare: AccessShare[] = [{ userId: owner.id, documentId: "d1", role: "VIEWER" }];
    expect(getAccess(owner, doc, withOwnerShare)).toBe("owner");
  });

  it("works with an empty share list", () => {
    expect(getAccess(bob, doc, [])).toBe("none");
  });
});

describe("capability helpers", () => {
  const table: [Access, boolean, boolean, boolean][] = [
    // access, view, edit, manage
    ["owner", true, true, true],
    ["editor", true, true, false],
    ["viewer", true, false, false],
    ["none", false, false, false],
  ];

  it.each(table)("%s -> view=%s edit=%s manage=%s", (access, view, edit, manage) => {
    expect(canView(access)).toBe(view);
    expect(canEdit(access)).toBe(edit);
    expect(canManage(access)).toBe(manage);
  });
});

describe("decideAccess (guard status mapping)", () => {
  it("signed out -> 401", () => {
    expect(decideAccess(null, doc, shares, "view")).toEqual({ ok: false, status: 401 });
  });

  it("signed out wins even if the doc is missing", () => {
    expect(decideAccess(null, null, [], "view")).toEqual({ ok: false, status: 401 });
  });

  it("missing doc and no-access doc return the identical 404", () => {
    const missing = decideAccess(stranger, null, [], "view");
    const noAccess = decideAccess(stranger, doc, shares, "view");
    expect(missing).toEqual({ ok: false, status: 404 });
    expect(noAccess).toEqual(missing);
  });

  it("no access is 404 for every needed level", () => {
    for (const needed of ["view", "edit", "manage"] as const) {
      expect(decideAccess(stranger, doc, shares, needed)).toEqual({ ok: false, status: 404 });
    }
  });

  it("viewer: can view, 403 for edit and manage", () => {
    expect(decideAccess(carol, doc, shares, "view")).toEqual({ ok: true, access: "viewer" });
    expect(decideAccess(carol, doc, shares, "edit")).toEqual({ ok: false, status: 403 });
    expect(decideAccess(carol, doc, shares, "manage")).toEqual({ ok: false, status: 403 });
  });

  it("editor: can view and edit, 403 for manage", () => {
    expect(decideAccess(bob, doc, shares, "view")).toEqual({ ok: true, access: "editor" });
    expect(decideAccess(bob, doc, shares, "edit")).toEqual({ ok: true, access: "editor" });
    expect(decideAccess(bob, doc, shares, "manage")).toEqual({ ok: false, status: 403 });
  });

  it("owner: allowed for every level", () => {
    for (const needed of ["view", "edit", "manage"] as const) {
      expect(decideAccess(owner, doc, shares, needed)).toEqual({ ok: true, access: "owner" });
    }
  });
});
