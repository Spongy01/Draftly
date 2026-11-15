// Documents route handlers: GET list (owned + shared), POST create
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createDocument, listDocumentsForUser } from "@/lib/documents";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await listDocumentsForUser(user.id));
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await createDocument(user.id);
  return NextResponse.json(doc, { status: 201 });
}
