// Share route handlers (owner only): GET list, POST add / change role, DELETE remove
import { NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/guard";
import {
  checkShareTarget,
  findUserIdByEmail,
  listShares,
  removeShare,
  upsertShare,
} from "@/lib/sharing";
import { fieldErrors, removeShareSchema, shareSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

const invalidBody = () => NextResponse.json({ error: "Invalid request body" }, { status: 400 });

function validationError(error: Parameters<typeof fieldErrors>[0]) {
  const fields = fieldErrors(error);
  const first = Object.values(fields)[0] ?? "Invalid request";
  return NextResponse.json({ error: first, fields }, { status: 400 });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await requireDocumentAccess(id, "manage");
  if (!g.ok) return g.response;

  return NextResponse.json({ shares: await listShares(g.doc.id) });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await requireDocumentAccess(id, "manage"); // before any body work
  if (!g.ok) return g.response;

  const raw = await readJson(request);
  if (!raw.ok) return invalidBody();

  const parsed = shareSchema.safeParse(raw.body);
  if (!parsed.success) return validationError(parsed.error);

  const targetUserId = await findUserIdByEmail(parsed.data.email);
  if (!targetUserId) {
    return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
  }

  const check = checkShareTarget({
    ownerId: g.doc.ownerId,
    actorId: g.user.id,
    targetUserId,
  });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { created, collaborator } = await upsertShare(g.doc.id, targetUserId, parsed.data.role);
  return NextResponse.json({ share: collaborator }, { status: created ? 201 : 200 });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await requireDocumentAccess(id, "manage"); // before any body work
  if (!g.ok) return g.response;

  const raw = await readJson(request);
  if (!raw.ok) return invalidBody();

  const parsed = removeShareSchema.safeParse(raw.body);
  if (!parsed.success) return validationError(parsed.error);

  const removed = await removeShare(g.doc.id, parsed.data.userId);
  if (!removed) {
    return NextResponse.json(
      { error: "That user does not have access to this document" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
