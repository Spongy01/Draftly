// Pure access logic: no database, no framework imports. Takes plain data, returns a role.

export type ShareRole = "VIEWER" | "EDITOR";
export type Access = "owner" | "editor" | "viewer" | "none";
export type Needed = "view" | "edit" | "manage";

export type AccessUser = { id: string } | null;
export type AccessDoc = { id: string; ownerId: string };
export type AccessShare = { userId: string; documentId: string; role: ShareRole };

export function getAccess(user: AccessUser, doc: AccessDoc, shares: AccessShare[]): Access {
  if (!user) return "none";
  if (user.id === doc.ownerId) return "owner";

  const share = shares.find((s) => s.documentId === doc.id && s.userId === user.id);
  if (!share) return "none";
  return share.role === "EDITOR" ? "editor" : "viewer";
}

export function canView(access: Access): boolean {
  return access !== "none";
}

export function canEdit(access: Access): boolean {
  return access === "owner" || access === "editor";
}

/** Managing sharing (and deleting) is owner-only. */
export function canManage(access: Access): boolean {
  return access === "owner";
}

export type GuardDecision =
  | { ok: true; access: Exclude<Access, "none"> }
  | { ok: false; status: 401 | 403 | 404 };

/**
 * Maps (user, doc, shares, needed) to a decision. Pure, so the status mapping is unit-testable.
 * - signed out -> 401
 * - doc missing OR user has no access -> 404 (identical, so existence is not revealed)
 * - can view but lacks the needed level -> 403
 */
export function decideAccess(
  user: AccessUser,
  doc: AccessDoc | null,
  shares: AccessShare[],
  needed: Needed,
): GuardDecision {
  if (!user) return { ok: false, status: 401 };
  if (!doc) return { ok: false, status: 404 };

  const access = getAccess(user, doc, shares);
  if (access === "none") return { ok: false, status: 404 };

  const allowed =
    needed === "view" ? canView(access) : needed === "edit" ? canEdit(access) : canManage(access);
  if (!allowed) return { ok: false, status: 403 };

  return { ok: true, access };
}
