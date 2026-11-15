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

/** PATCH /api/documents/[id]: only `title` is accepted for now (unknown keys are rejected). */
export const renameSchema = z.strictObject({ title: titleSchema });

/** Flattens zod issues into { fieldName: firstMessage } for 400 responses. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}
