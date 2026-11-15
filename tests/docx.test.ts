import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importFile } from "../src/lib/import";
import { MESSAGES } from "../src/lib/import/constants";

const fixture = new Uint8Array(readFileSync(join(__dirname, "fixtures", "sample.docx")));

describe("docx import (real .docx fixture, generated with a zip of OOXML parts)", () => {
  it("keeps headings, bold, italic, underline and lists", async () => {
    const r = await importFile({ name: "Quarterly_Plan.docx", bytes: fixture });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.title).toBe("Quarterly Plan");
    expect(r.html).toContain("<h1>Quarterly Plan</h1>");
    expect(r.html).toContain("<h2>Goals</h2>");
    expect(r.html).toContain("<strong>bold</strong>");
    expect(r.html).toContain("<em>italic</em>");
    expect(r.html).toContain("<u>underlined</u>");
    expect(r.html).toContain("<ul><li>First bullet</li><li>Second bullet</li></ul>");
    expect(r.html).toContain("<ol><li>Step one</li><li>Step two</li></ol>");
  });

  it("escapes special characters without double-escaping", async () => {
    const r = await importFile({ name: "a.docx", bytes: fixture });
    expect(r.ok && r.html).toContain("R&amp;D &lt;draft&gt;.");
    expect(r.ok && r.html).not.toContain("&amp;amp;");
  });

  it("strips the embedded image completely (no img, no base64)", async () => {
    const r = await importFile({ name: "a.docx", bytes: fixture });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("data:");
    expect(r.html).not.toContain("base64");
  });

  it("returns a clean 400 for a corrupt .docx (random bytes)", async () => {
    const junk = new Uint8Array(500).map((_, i) => (i * 37) % 251);
    expect(await importFile({ name: "bad.docx", bytes: junk })).toEqual({
      ok: false,
      status: 400,
      error: MESSAGES.docx,
    });
  });

  it("returns a clean 400 for plain text renamed to .docx", async () => {
    const r = await importFile({ name: "fake.docx", bytes: new TextEncoder().encode("just text") });
    expect(r).toEqual({ ok: false, status: 400, error: MESSAGES.docx });
  });

  it("returns a clean 400 for a truncated .docx", async () => {
    const r = await importFile({ name: "cut.docx", bytes: fixture.slice(0, 400) });
    expect(r).toEqual({ ok: false, status: 400, error: MESSAGES.docx });
  });
});
