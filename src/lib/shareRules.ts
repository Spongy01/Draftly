// Pure share-target rule: no imports, no database, unit-testable

export type ShareTargetCheck = { ok: true } | { ok: false; status: 400; error: string };

/**
 * Pure rule: who can a document be shared with? Not yourself, and not the owner
 * (the owner already has full access). No database access, so it is unit-testable.
 */
export function checkShareTarget(input: {
  ownerId: string;
  actorId: string;
  targetUserId: string;
}): ShareTargetCheck {
  if (input.targetUserId === input.actorId) {
    return { ok: false, status: 400, error: "You can't share a document with yourself" };
  }
  if (input.targetUserId === input.ownerId) {
    return { ok: false, status: 400, error: "The owner already has full access" };
  }
  return { ok: true };
}
