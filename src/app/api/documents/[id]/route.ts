// Single-document route handlers: GET (view), PATCH (edit: title and/or contentHtml)
import { NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/guard";
import { getOwnerName, updateDocument } from "@/lib/documents";
import { sanitizeContent } from "@/lib/sanitize";
import {
  CONTENT_MAX_BYTES,
  CONTENT_TOO_LARGE_MESSAGE,
  fieldErrors,
  isContentTooLarge,
  updateDocumentSchema,
} from "@/lib/validation";

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

const tooLarge = () =>
  NextResponse.json(
    { error: CONTENT_TOO_LARGE_MESSAGE, fields: { contentHtml: CONTENT_TOO_LARGE_MESSAGE } },
    { status: 413 },
  );

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await requireDocumentAccess(id, "edit");
  if (!g.ok) return g.response;

  // Cheap rejection before reading the body. JSON escaping can make the body larger than the
  // string it carries, so this threshold is deliberately loose; the exact check follows below.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > CONTENT_MAX_BYTES * 2) return tooLarge();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Size check on the raw string, before zod and before sanitizing.
  if (typeof body === "object" && body !== null && isContentTooLarge((body as Record<string, unknown>).contentHtml)) {
    return tooLarge();
  }

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return NextResponse.json(
      { error: fields.title ?? fields.contentHtml ?? fields._ ?? "Invalid request", fields },
      { status: 400 },
    );
  }

  const { title, contentHtml } = parsed.data;
  const updated = await updateDocument(g.doc.id, {
    title,
    contentHtml: contentHtml === undefined ? undefined : sanitizeContent(contentHtml),
  });
  return NextResponse.json(updated);
}
