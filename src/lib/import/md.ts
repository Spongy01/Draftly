// .md to HTML with marked. Output always goes through the sanitizer afterwards, which also
// neutralizes raw HTML written inside the markdown.
import { Marked } from "marked";
import { escapeHtml, type ConvertResult } from "./txt";

const marked = new Marked({
  gfm: true,
  async: false,
  renderer: {
    // Code blocks become one paragraph, one <br> per line (no <pre>/<code> in the allowlist).
    code({ text }) {
      return `<p>${text.replace(/\n$/, "").split("\n").map(escapeHtml).join("<br>")}</p>\n`;
    },
    // Blockquotes become plain paragraphs (their inner blocks, without the wrapper).
    blockquote({ tokens }) {
      return this.parser.parse(tokens);
    },
    // Only h1-h3 exist in the editor; deeper headings become h3.
    heading({ tokens, depth }) {
      const level = Math.min(depth, 3);
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
    hr() {
      return "";
    },
  },
});

export function mdToHtml(bytes: Uint8Array): ConvertResult {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/\r\n?/g, "\n");
  return { ok: true, html: marked.parse(text) as string };
}
