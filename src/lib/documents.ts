// Document data access (explicit selects only; never returns emails or other user fields)
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export type DocSummary = { id: string; title: string; updatedAt: Date };
export type SharedDocSummary = DocSummary & { role: Role; ownerName: string };

const summarySelect = { id: true, title: true, updatedAt: true } as const;

export async function createDocument(ownerId: string): Promise<DocSummary> {
  return db.document.create({
    data: { title: "Untitled document", contentHtml: "", ownerId },
    select: summarySelect,
  });
}

export async function listDocumentsForUser(
  userId: string,
): Promise<{ owned: DocSummary[]; shared: SharedDocSummary[] }> {
  const [owned, shares] = await Promise.all([
    db.document.findMany({
      where: { ownerId: userId },
      select: summarySelect,
      orderBy: { updatedAt: "desc" },
    }),
    db.share.findMany({
      where: { userId },
      select: {
        role: true,
        document: {
          select: { ...summarySelect, owner: { select: { name: true } } },
        },
      },
      orderBy: { document: { updatedAt: "desc" } },
    }),
  ]);

  const shared = shares.map((s) => ({
    id: s.document.id,
    title: s.document.title,
    updatedAt: s.document.updatedAt,
    role: s.role,
    ownerName: s.document.owner.name,
  }));

  return { owned, shared };
}

export async function getOwnerName(ownerId: string): Promise<string> {
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { name: true } });
  return owner?.name ?? "Unknown";
}

export async function renameDocument(id: string, title: string): Promise<DocSummary> {
  return db.document.update({ where: { id }, data: { title }, select: summarySelect });
}
