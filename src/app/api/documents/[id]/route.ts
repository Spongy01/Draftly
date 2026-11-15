// Single-document route handlers: GET (view), PATCH (edit, title only for now)
import { NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/guard";
import { getOwnerName, renameDocument } from "@/lib/documents";
import { fieldErrors, renameSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await requireDocumentAccess(id, "view");
  if (!g.ok) return g.response;

  return NextResponse.json({
    id: g.doc.id,
    title: g.doc.title,
    contentHtml: g.doc.contentHtml,
    updatedAt: g.doc.updatedAt,
    access: g.access,
    ownerName: await getOwnerName(g.doc.ownerId),
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await requireDocumentAccess(id, "edit");
  if (!g.ok) return g.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return NextResponse.json(
      { error: fields.title ?? "Only title can be updated", fields },
      { status: 400 },
    );
  }

  const updated = await renameDocument(g.doc.id, parsed.data.title);
  return NextResponse.json(updated);
}
