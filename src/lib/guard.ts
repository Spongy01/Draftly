// Route/page guard: loads user + doc + shares, then applies the pure access decision
import { NextResponse } from "next/server";
import type { Document } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decideAccess, type Access, type Needed } from "@/lib/access";

export type GuardResult =
  | { ok: true; user: CurrentUser; doc: Document; access: Exclude<Access, "none"> }
  | { ok: false; status: 401 | 403 | 404; response: NextResponse };

const ERRORS = {
  401: "Unauthorized",
  403: "Forbidden",
  404: "Document not found",
} as const;

function fail(status: 401 | 403 | 404): GuardResult {
  return { ok: false, status, response: NextResponse.json({ error: ERRORS[status] }, { status }) };
}

/**
 * Route handlers: `if (!g.ok) return g.response;`
 * Server pages:   on !g.ok, 401 -> redirect("/login"); 403/404 -> notFound().
 */
export async function requireDocumentAccess(docId: string, needed: Needed): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) return fail(401);

  const row = await db.document.findUnique({
    where: { id: docId },
    include: { shares: true },
  });

  const decision = decideAccess(user, row, row?.shares ?? [], needed);
  if (!decision.ok) return fail(decision.status);
  if (!row) return fail(404); // unreachable (decideAccess returns 404 for null); narrows the type

  // Strip the shares relation so callers can't leak the share list to non-owners by accident.
  const { shares: _shares, ...doc } = row;
  void _shares;
  return { ok: true, user, doc, access: decision.access };
}
