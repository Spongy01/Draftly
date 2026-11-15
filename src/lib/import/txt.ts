// .txt to HTML: escape, blank lines separate paragraphs, single line breaks become <br>
import { MESSAGES } from "./constants";

export type ConvertResult = { ok: true; html: string } | { ok: false; error: string };

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function txtToHtml(bytes: Uint8Array): ConvertResult {
  if (bytes.includes(0)) return { ok: false, error: MESSAGES.binary };

  // Lenient UTF-8 decode (a BOM is stripped; invalid bytes become U+FFFD).
  const text = new TextDecoder("utf-8").decode(bytes).replace(/\r\n?/g, "\n");

  const html = text
    .split(/\n[ \t]*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${block.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");

  return { ok: true, html };
}
