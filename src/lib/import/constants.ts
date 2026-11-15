// Upload constants and messages. No server-only imports, so the dashboard can use them too.

export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024; // Vercel's request body limit is about 4.5 MB
export const UPLOAD_MAX_LABEL = "2 MB";

export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;
export const SUPPORTED_LABEL = ".txt, .md, .docx";

export const MESSAGES = {
  unsupported: `Unsupported file type. Supported types: ${SUPPORTED_LABEL}`,
  tooLarge: `File is too large (max ${UPLOAD_MAX_LABEL})`,
  empty: "The file is empty",
  binary: "This looks like a binary file, not plain text",
  noText: "No readable text found in this file",
  docx: "Could not read this .docx file",
  noFile: "No file provided. Upload one file in the 'file' field",
  manyFiles: "Upload exactly one file",
  badForm: "Expected a multipart form upload",
} as const;

/** Lower-cased extension including the dot ("Notes.MD" -> ".md"), or "" if none. */
export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

export function isSupportedExtension(ext: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}
