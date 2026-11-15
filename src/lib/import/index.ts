// Import pipeline: validate -> convert -> sanitize -> check content. No database access.
import { sanitizeContent } from "../sanitize";
import { CONTENT_TOO_LARGE_MESSAGE, isContentTooLarge } from "../validation";
import { extensionOf, isSupportedExtension, MESSAGES, UPLOAD_MAX_BYTES } from "./constants";
import { docxToHtml } from "./docx";
import { mdToHtml } from "./md";
import { titleFromFilename } from "./title";
import { txtToHtml, type ConvertResult } from "./txt";

export type ImportResult =
  | { ok: true; title: string; html: string }
  | { ok: false; status: 400 | 413; error: string };

/** True if sanitized HTML contains any visible text (tags and whitespace do not count). */
export function hasTextContent(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .trim();
  return text.length > 0;
}

export async function importFile(input: { name: string; bytes: Uint8Array }): Promise<ImportResult> {
  const ext = extensionOf(input.name);
  if (!isSupportedExtension(ext)) return { ok: false, status: 400, error: MESSAGES.unsupported };
  if (input.bytes.length === 0) return { ok: false, status: 400, error: MESSAGES.empty };
  if (input.bytes.length > UPLOAD_MAX_BYTES) return { ok: false, status: 413, error: MESSAGES.tooLarge };

  let converted: ConvertResult;
  if (ext === ".txt") converted = txtToHtml(input.bytes);
  else if (ext === ".md") converted = mdToHtml(input.bytes);
  else converted = await docxToHtml(input.bytes);
  if (!converted.ok) return { ok: false, status: 400, error: converted.error };

  const html = sanitizeContent(converted.html);
  if (!hasTextContent(html)) return { ok: false, status: 400, error: MESSAGES.noText };
  if (isContentTooLarge(html)) return { ok: false, status: 413, error: CONTENT_TOO_LARGE_MESSAGE };

  return { ok: true, title: titleFromFilename(input.name), html };
}
