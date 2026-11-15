import { describe, expect, it } from "vitest";
import { hasTextContent, importFile } from "../src/lib/import";
import { MESSAGES, UPLOAD_MAX_BYTES, extensionOf } from "../src/lib/import/constants";
import { mdToHtml } from "../src/lib/import/md";
import { titleFromFilename } from "../src/lib/import/title";
import { txtToHtml } from "../src/lib/import/txt";
import { sanitizeContent } from "../src/lib/sanitize";

const enc = (s: string) => new TextEncoder().encode(s);
const txt = (s: string) => {
  const r = txtToHtml(enc(s));
  if (!r.ok) throw new Error(r.error);
  return r.html;
};
const md = (s: string) => {
  const r = mdToHtml(enc(s));
  if (!r.ok) throw new Error(r.error);
  return sanitizeContent(r.html);
};

describe("txt converter", () => {
  it("splits on blank lines into paragraphs", () => {
    expect(txt("one\n\ntwo\n\n\n\nthree")).toBe("<p>one</p><p>two</p><p>three</p>");
  });

  it("keeps single line breaks as <br>", () => {
    expect(txt("line a\nline b\n\nnext")).toBe("<p>line a<br>line b</p><p>next</p>");
  });

  it("handles Windows and old Mac line endings", () => {
    expect(txt("a\r\nb\r\n\r\nc")).toBe("<p>a<br>b</p><p>c</p>");
    expect(txt("a\rb")).toBe("<p>a<br>b</p>");
  });

  it("treats whitespace-only lines as blank lines", () => {
    expect(txt("a\n   \t \nb")).toBe("<p>a</p><p>b</p>");
  });

  it("escapes HTML so markup in a text file is shown as text", () => {
    const html = txt('<script>alert(1)</script> & "q"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("strips a UTF-8 BOM and keeps unicode", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc("café €5")]);
    const r = txtToHtml(bytes);
    expect(r.ok && r.html).toBe("<p>café €5</p>");
  });

  it("rejects binary content (null bytes)", () => {
    const r = txtToHtml(new Uint8Array([72, 105, 0, 33]));
    expect(r).toEqual({ ok: false, error: MESSAGES.binary });
  });

  it("returns no paragraphs for whitespace only", () => {
    expect(txt(" \n\n \n")).toBe("");
  });
});

describe("markdown converter", () => {
  it("converts headings, bold, italic and lists", () => {
    const html = md("# Title\n\n## Sub\n\nSome **bold** and *italic*.\n\n- a\n- b\n\n1. one\n2. two\n");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Sub</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>a</li>");
  });

  it("maps headings deeper than 3 to h3", () => {
    expect(md("###### Deep")).toBe("<h3>Deep</h3>\n");
  });

  it("removes a <script> written inside markdown", () => {
    const html = md("Hello\n\n<script>alert('x')</script>\n\nworld");
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
    expect(html).toContain("Hello");
    expect(html).toContain("world");
  });

  it("removes inline raw HTML handlers and images", () => {
    const html = md('Text <img src=x onerror=alert(1)> ![alt](http://x/y.png) <b onclick="e()">b</b>');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("onclick");
  });

  it("keeps link text but drops the link", () => {
    const html = md("See [the docs](https://example.com/docs) now");
    expect(html).toContain("the docs");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("href");
  });

  it("renders a code block as one paragraph with <br> between lines", () => {
    const html = md("```js\nconst a = 1;\nconst b = 2;\n```\n");
    expect(html).toBe("<p>const a = 1;<br />const b = 2;</p>\n");
  });

  it("escapes angle brackets inside code blocks", () => {
    const html = md("```\n<div>hi</div>\n```\n");
    expect(html).not.toContain("<div>");
    expect(html).toContain("&lt;div&gt;hi&lt;/div&gt;");
  });

  it("renders blockquotes as plain paragraphs", () => {
    const html = md("> quoted line\n\nafter");
    expect(html).not.toContain("blockquote");
    expect(html).toContain("<p>quoted line</p>");
    expect(html).toContain("<p>after</p>");
  });

  it("drops horizontal rules", () => {
    expect(md("a\n\n---\n\nb")).not.toContain("hr");
  });

  it("keeps table text (known limitation: formatting is lost)", () => {
    const html = md("| a | b |\n|---|---|\n| 1 | 2 |\n");
    expect(html).not.toContain("<table");
    expect(html).toContain("1");
    expect(html).toContain("2");
  });
});

describe("titleFromFilename", () => {
  it.each([
    ["notes.txt", "notes"],
    ["Meeting_Notes_2026.md", "Meeting Notes 2026"],
    ["report.final.docx", "report.final"],
    ["  spaced   out .txt", "spaced out"],
    ["C:\\fakepath\\My_File.docx", "My File"],
    ["/tmp/dir/plan.md", "plan"],
    ["noextension", "noextension"],
    [".hidden", ".hidden"],
  ])("%s -> %s", (input, expected) => {
    expect(titleFromFilename(input)).toBe(expected);
  });

  it("truncates to 120 characters", () => {
    const title = titleFromFilename(`${"a".repeat(200)}.txt`);
    expect(title).toHaveLength(120);
  });

  it.each(["___.md", "   .docx", "_ _.txt", ""])("falls back for %j", (input) => {
    expect(titleFromFilename(input)).toBe("Imported document");
  });
});

describe("hasTextContent", () => {
  it("is false for empty or tag-only html", () => {
    expect(hasTextContent("")).toBe(false);
    expect(hasTextContent("<p></p>")).toBe(false);
    expect(hasTextContent("<p> </p><ul><li></li></ul>")).toBe(false);
    expect(hasTextContent("<p>&nbsp;</p>")).toBe(false);
    expect(hasTextContent("<p><br /></p>")).toBe(false);
  });

  it("is true when there is visible text", () => {
    expect(hasTextContent("<p>hi</p>")).toBe(true);
    expect(hasTextContent("<h1>x</h1>")).toBe(true);
    expect(hasTextContent("<p>&amp;</p>")).toBe(true);
  });
});

describe("importFile", () => {
  it("imports a txt file with a title from the filename", async () => {
    const r = await importFile({ name: "My_Notes.txt", bytes: enc("hello\n\nworld") });
    expect(r).toEqual({ ok: true, title: "My Notes", html: "<p>hello</p><p>world</p>" });
  });

  it("imports markdown and sanitizes it", async () => {
    const r = await importFile({ name: "a.md", bytes: enc("# Hi\n\n<script>x()</script>") });
    expect(r.ok && r.html).toBe("<h1>Hi</h1>\n");
  });

  it("decides the type by extension, case-insensitively", async () => {
    expect((await importFile({ name: "A.TXT", bytes: enc("x") })).ok).toBe(true);
    expect((await importFile({ name: "A.Md", bytes: enc("x") })).ok).toBe(true);
  });

  it.each(["a.pdf", "a.doc", "a.rtf", "a", "a.txt.exe", "a.html"])("rejects unsupported type %s", async (name) => {
    const r = await importFile({ name, bytes: enc("some content") });
    expect(r).toEqual({ ok: false, status: 400, error: MESSAGES.unsupported });
  });

  it("lists the supported types in the unsupported message", () => {
    expect(MESSAGES.unsupported).toContain(".txt");
    expect(MESSAGES.unsupported).toContain(".md");
    expect(MESSAGES.unsupported).toContain(".docx");
  });

  it("rejects an empty file", async () => {
    expect(await importFile({ name: "a.txt", bytes: new Uint8Array() })).toEqual({
      ok: false,
      status: 400,
      error: MESSAGES.empty,
    });
  });

  it("rejects a file over 2 MB with 413", async () => {
    const r = await importFile({ name: "a.txt", bytes: new Uint8Array(UPLOAD_MAX_BYTES + 1).fill(97) });
    expect(r).toEqual({ ok: false, status: 413, error: MESSAGES.tooLarge });
  });

  it("accepts a file of exactly 2 MB if it converts within the content cap", async () => {
    // 2 MB of short lines would exceed 500 KB of html, so just check the size gate is not the failure.
    const r = await importFile({ name: "a.txt", bytes: new Uint8Array(UPLOAD_MAX_BYTES).fill(97) });
    expect(r.ok === false && r.error).not.toBe(MESSAGES.tooLarge);
  });

  it("rejects whitespace-only text with a no-text message", async () => {
    expect(await importFile({ name: "a.txt", bytes: enc("  \n\n \t ") })).toEqual({
      ok: false,
      status: 400,
      error: MESSAGES.noText,
    });
  });

  it("rejects markdown that is only an image", async () => {
    const r = await importFile({ name: "a.md", bytes: enc("![pic](http://x/y.png)") });
    expect(r).toEqual({ ok: false, status: 400, error: MESSAGES.noText });
  });

  it("rejects a binary .txt", async () => {
    expect(await importFile({ name: "a.txt", bytes: new Uint8Array([1, 2, 0, 3]) })).toEqual({
      ok: false,
      status: 400,
      error: MESSAGES.binary,
    });
  });

  it("returns 413 when converted content exceeds the 500 KB cap", async () => {
    // ~600 KB of distinct paragraphs (under 2 MB) converts to more than 500 KB of HTML.
    const big = Array.from({ length: 60_000 }, (_, i) => `para ${i}`).join("\n\n");
    expect(big.length).toBeLessThan(UPLOAD_MAX_BYTES);
    const r = await importFile({ name: "big.txt", bytes: enc(big) });
    expect(r).toEqual({ ok: false, status: 413, error: "Content is too large (max 500 KB)" });
  });

  it("extensionOf handles odd names", () => {
    expect(extensionOf("a.TXT")).toBe(".txt");
    expect(extensionOf("dir.d/file")).toBe("");
    expect(extensionOf(".bashrc")).toBe("");
  });
});
