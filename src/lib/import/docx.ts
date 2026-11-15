// .docx to HTML with mammoth, fully in memory (a Buffer, never a path; no temp files)
import mammoth from "mammoth";
import { MESSAGES } from "./constants";
import type { ConvertResult } from "./txt";

export async function docxToHtml(bytes: Uint8Array): Promise<ConvertResult> {
  try {
    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      {
        // mammoth ignores underlining by default; <u> is in our allowlist.
        styleMap: ["u => u"],
        // Never read image bytes (no base64). The empty <img> is stripped by the sanitizer.
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
      },
    );
    return { ok: true, html: result.value };
  } catch {
    return { ok: false, error: MESSAGES.docx };
  }
}
