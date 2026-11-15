import { describe, expect, it } from "vitest";
import { fieldErrors, renameSchema, titleSchema } from "../src/lib/validation";

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

describe("renameSchema", () => {
  it("accepts { title } and returns the trimmed value", () => {
    expect(renameSchema.parse({ title: " New name " })).toEqual({ title: "New name" });
  });

  it("rejects extra keys such as contentHtml", () => {
    expect(renameSchema.safeParse({ title: "ok", contentHtml: "<p>x</p>" }).success).toBe(false);
  });

  it("rejects a missing title", () => {
    expect(renameSchema.safeParse({}).success).toBe(false);
  });

  it("produces a field message for an empty title", () => {
    const r = renameSchema.safeParse({ title: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).title).toBe("Title is required");
  });

  it("produces a field message for an over-long title", () => {
    const r = renameSchema.safeParse({ title: "a".repeat(121) });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).title).toMatch(/120/);
  });
});
