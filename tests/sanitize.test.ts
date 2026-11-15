import { describe, expect, it } from "vitest";
import { ALLOWED_TAGS, sanitizeContent } from "../src/lib/sanitize";

describe("sanitizeContent", () => {
  it("removes script tags and their contents", () => {
    const out = sanitizeContent('<p>Hi</p><script>alert("x")</script>');
    expect(out).toBe("<p>Hi</p>");
    expect(out).not.toContain("alert");
  });

  it("removes img tags, including onerror handlers", () => {
    const out = sanitizeContent('<p>a<img src="x" onerror="alert(1)">b</p>');
    expect(out).toBe("<p>ab</p>");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<img");
  });

  it("removes base64 images", () => {
    const out = sanitizeContent('<p><img src="data:image/png;base64,AAAA"></p>');
    expect(out).toBe("<p></p>");
  });

  it("strips style and class attributes from allowed tags", () => {
    const out = sanitizeContent('<p style="color:red" class="x" id="y">Hi</p>');
    expect(out).toBe("<p>Hi</p>");
  });

  it("strips on* event handler attributes", () => {
    expect(sanitizeContent('<p onclick="evil()">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("unwraps links but keeps their text (no href survives)", () => {
    const out = sanitizeContent('<p><a href="javascript:alert(1)">click</a></p>');
    expect(out).toBe("<p>click</p>");
  });

  it("unwraps disallowed tags but keeps their text", () => {
    expect(sanitizeContent("<div><span>hello</span> world</div>")).toBe("hello world");
    expect(sanitizeContent("<blockquote><p>quoted</p></blockquote>")).toBe("<p>quoted</p>");
    expect(sanitizeContent("<pre><code>let a = 1</code></pre>")).toBe("let a = 1");
  });

  it("removes style tags and their contents", () => {
    expect(sanitizeContent("<style>p{color:red}</style><p>Hi</p>")).toBe("<p>Hi</p>");
  });

  it.each(ALLOWED_TAGS.filter((t) => t !== "br"))("preserves <%s>", (tag) => {
    expect(sanitizeContent(`<${tag}>text</${tag}>`)).toBe(`<${tag}>text</${tag}>`);
  });

  it("preserves <br>", () => {
    expect(sanitizeContent("<p>a<br>b</p>")).toBe("<p>a<br />b</p>");
  });

  it("preserves nested lists and inline formatting", () => {
    const html = "<ul><li><strong>a</strong></li><li><em>b</em><u>c</u></li></ul><ol><li>1</li></ol>";
    expect(sanitizeContent(html)).toBe(html);
  });

  it("allowlist is exactly the documented set", () => {
    expect([...ALLOWED_TAGS].sort()).toEqual(
      ["br", "em", "h1", "h2", "h3", "li", "ol", "p", "strong", "u", "ul"].sort(),
    );
  });

  it("escapes stray angle brackets in text", () => {
    expect(sanitizeContent("<p>1 < 2</p>")).not.toContain("<2");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeContent("")).toBe("");
  });
});
