// Sharing data logic: list / upsert / remove shares (the pure target rule lives in shareRules.ts)
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export { checkShareTarget, type ShareTargetCheck } from "@/lib/shareRules";

export type Collaborator = { userId: string; name: string; email: string; role: Role };

const collaboratorSelect = {
  role: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

function toCollaborator(s: { role: Role; user: { id: string; name: string; email: string } }): Collaborator {
  return { userId: s.user.id, name: s.user.name, email: s.user.email, role: s.role };
}

export async function listShares(documentId: string): Promise<Collaborator[]> {
  const shares = await db.share.findMany({
    where: { documentId },
    select: collaboratorSelect,
    orderBy: { createdAt: "asc" },
  });
  return shares.map(toCollaborator);
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}

/** Creates the share or updates its role. `created` tells the route whether to answer 201 or 200. */
export async function upsertShare(
  documentId: string,
  userId: string,
  role: Role,
): Promise<{ created: boolean; collaborator: Collaborator }> {
  const key = { documentId_userId: { documentId, userId } };
  const existing = await db.share.findUnique({ where: key, select: { id: true } });
  const share = await db.share.upsert({
    where: key,
    update: { role },
    create: { documentId, userId, role },
    select: collaboratorSelect,
  });
  return { created: !existing, collaborator: toCollaborator(share) };
}

/** Returns false if that user had no share on the document. */
export async function removeShare(documentId: string, userId: string): Promise<boolean> {
  const { count } = await db.share.deleteMany({ where: { documentId, userId } });
  return count > 0;
}
