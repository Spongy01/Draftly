import { describe, expect, it } from "vitest";
import {
  CONTENT_MAX_BYTES,
  fieldErrors,
  isContentTooLarge,
  titleSchema,
  updateDocumentSchema,
} from "../src/lib/validation";

describe("titleSchema", () => {
  it("trims whitespace", () => {
    expect(titleSchema.parse("  Hello  ")).toBe("Hello");
  });

  it("rejects an empty string", () => {
    expect(titleSchema.safeParse("").success).toBe(false);
  });

  it("rejects whitespace-only", () => {
    expect(titleSchema.safeParse("    ").success).toBe(false);
  });

  it("accepts exactly 120 characters and rejects 121", () => {
    expect(titleSchema.safeParse("a".repeat(120)).success).toBe(true);
    expect(titleSchema.safeParse("a".repeat(121)).success).toBe(false);
  });

  it("counts length after trimming", () => {
    expect(titleSchema.safeParse(`  ${"a".repeat(120)}  `).success).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(titleSchema.safeParse(42).success).toBe(false);
    expect(titleSchema.safeParse(null).success).toBe(false);
    expect(titleSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("updateDocumentSchema", () => {
  it("accepts { title } and returns the trimmed value", () => {
    expect(updateDocumentSchema.parse({ title: " New name " })).toEqual({ title: "New name" });
  });

  it("accepts { contentHtml } alone", () => {
    expect(updateDocumentSchema.parse({ contentHtml: "<p>Hi</p>" })).toEqual({
      contentHtml: "<p>Hi</p>",
    });
  });

  it("accepts both fields together", () => {
    const r = updateDocumentSchema.safeParse({ title: "T", contentHtml: "" });
    expect(r.success).toBe(true);
  });

  it("accepts an empty-string contentHtml (clearing the document)", () => {
    expect(updateDocumentSchema.safeParse({ contentHtml: "" }).success).toBe(true);
  });

  it("rejects an empty object (at least one field required)", () => {
    const r = updateDocumentSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)._).toBe("Provide a title or contentHtml");
  });

  it("rejects unknown keys", () => {
    expect(updateDocumentSchema.safeParse({ title: "ok", ownerId: "x" }).success).toBe(false);
    expect(updateDocumentSchema.safeParse({ contentHtml: "x", id: "y" }).success).toBe(false);
  });

  it("rejects non-string contentHtml", () => {
    const r = updateDocumentSchema.safeParse({ contentHtml: 5 });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).contentHtml).toBe("Content must be a string");
  });

  it("still validates the title when sent with content", () => {
    const r = updateDocumentSchema.safeParse({ title: "   ", contentHtml: "<p>x</p>" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).title).toBe("Title is required");
  });

  it("produces a field message for an over-long title", () => {
    const r = updateDocumentSchema.safeParse({ title: "a".repeat(121) });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).title).toMatch(/120/);
  });

  it("rejects contentHtml over 500 KB but accepts exactly 500 KB", () => {
    expect(updateDocumentSchema.safeParse({ contentHtml: "a".repeat(CONTENT_MAX_BYTES) }).success).toBe(true);
    const r = updateDocumentSchema.safeParse({ contentHtml: "a".repeat(CONTENT_MAX_BYTES + 1) });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).contentHtml).toMatch(/500 KB/);
  });
});

describe("isContentTooLarge", () => {
  it("is false for non-strings and small strings", () => {
    expect(isContentTooLarge(undefined)).toBe(false);
    expect(isContentTooLarge(123)).toBe(false);
    expect(isContentTooLarge("<p>hi</p>")).toBe(false);
  });

  it("counts bytes, not characters, for multi-byte text", () => {
    // 3-byte characters: 175,000 chars = 525,000 bytes > 512,000 (500 KB)
    expect(isContentTooLarge("€".repeat(175_000))).toBe(true);
    expect(isContentTooLarge("€".repeat(100_000))).toBe(false);
  });

  it("is true once the character count alone exceeds the limit", () => {
    expect(isContentTooLarge("a".repeat(CONTENT_MAX_BYTES + 1))).toBe(true);
  });
});
