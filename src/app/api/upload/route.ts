// Upload route handler: POST /api/upload (multipart, one file) creates a new owned document
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createDocument } from "@/lib/documents";
import { MESSAGES, UPLOAD_MAX_BYTES } from "@/lib/import/constants";
import { importFile } from "@/lib/import";

export const runtime = "nodejs";

// Multipart framing adds a little to the file size; the exact check runs on the parsed file.
const MULTIPART_SLACK = 64 * 1024;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Unauthorized");

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > UPLOAD_MAX_BYTES + MULTIPART_SLACK) {
    return fail(413, MESSAGES.tooLarge);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, MESSAGES.badForm);
  }

  // Exactly one file, in the "file" field.
  const files = [...form.entries()].filter(([, value]) => typeof value !== "string") as [string, File][];
  if (files.length === 0) return fail(400, MESSAGES.noFile);
  if (files.length > 1) return fail(400, MESSAGES.manyFiles);
  const [fieldName, file] = files[0];
  if (fieldName !== "file") return fail(400, MESSAGES.noFile);

  if (file.size > UPLOAD_MAX_BYTES) return fail(413, MESSAGES.tooLarge);

  const result = await importFile({
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return fail(result.status, result.error);

  const doc = await createDocument(user.id, { title: result.title, contentHtml: result.html });
  return NextResponse.json({ id: doc.id }, { status: 201 });
}
