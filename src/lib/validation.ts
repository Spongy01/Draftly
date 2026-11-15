// zod schemas for API inputs
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const titleSchema = z
  .string({ error: "Title is required" })
  .trim()
  .min(1, "Title is required")
  .max(120, "Title must be 120 characters or fewer");

/** Max size of raw contentHtml accepted by PATCH, checked before sanitizing. */
export const CONTENT_MAX_BYTES = 500 * 1024;

/**
 * Cheap size check: avoids encoding the string unless it is in the ambiguous range
 * (a UTF-8 character is 1 to 3 bytes for the BMP, up to 4 for astral code points).
 */
export function isContentTooLarge(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.length > CONTENT_MAX_BYTES) return true; // bytes >= chars
  if (value.length * 4 <= CONTENT_MAX_BYTES) return false; // bytes <= 4 * chars
  return new TextEncoder().encode(value).length > CONTENT_MAX_BYTES;
}

export const CONTENT_TOO_LARGE_MESSAGE = "Content is too large (max 500 KB)";

const contentHtmlSchema = z
  .string({ error: "Content must be a string" })
  .refine((v) => !isContentTooLarge(v), { error: CONTENT_TOO_LARGE_MESSAGE });

/** PATCH /api/documents/[id]: optional title and/or contentHtml, at least one; unknown keys rejected. */
export const updateDocumentSchema = z
  .strictObject({
    title: titleSchema.optional(),
    contentHtml: contentHtmlSchema.optional(),
  })
  .refine((v) => v.title !== undefined || v.contentHtml !== undefined, {
    error: "Provide a title or contentHtml",
  });

/** Flattens zod issues into { fieldName: firstMessage } for 400 responses. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/** Trim and lowercase first, then validate, so " Bob@Example.com " is accepted and normalized. */
const normalizedEmail = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

/** POST /api/documents/[id]/share */
export const shareSchema = z.strictObject({
  email: normalizedEmail,
  role: z.enum(["VIEWER", "EDITOR"], { error: "Role must be VIEWER or EDITOR" }),
});

/** DELETE /api/documents/[id]/share */
export const removeShareSchema = z.strictObject({
  userId: z.string({ error: "userId is required" }).min(1, "userId is required"),
});
