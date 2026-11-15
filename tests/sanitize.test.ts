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

  describe("idempotence (autosave re-sanitizes editor HTML repeatedly)", () => {
    const inputs = [
      "<h1>Title</h1><p>Hello <strong>bold</strong>, <em>italic</em> and <u>underlined</u>.</p>",
      "<ul><li>one</li><li>two <strong>b</strong></li></ul><ol><li>1</li><li>2</li></ol>",
      "<p>Line one<br>line two</p><h2>Sub</h2><h3>Smaller</h3>",
      "<p>Tom &amp; Jerry &lt;3 &gt; everyone</p>",
      '<div style="x"><span>unwrapped</span></div><p onclick="e()">kept</p><script>bad()</script>',
      "<p></p>",
      "",
    ];

    it.each(inputs)("sanitize(sanitize(x)) === sanitize(x): %s", (x) => {
      const once = sanitizeContent(x);
      expect(sanitizeContent(once)).toBe(once);
    });

    it("stays stable across many passes", () => {
      let out = sanitizeContent(inputs[3]);
      const first = out;
      for (let i = 0; i < 25; i++) out = sanitizeContent(out);
      expect(out).toBe(first);
    });
  });

  describe("special characters are not double-escaped", () => {
    it("keeps &amp; as &amp; after repeated saves", () => {
      let out = "<p>Tom &amp; Jerry</p>";
      for (let i = 0; i < 5; i++) out = sanitizeContent(out);
      expect(out).toBe("<p>Tom &amp; Jerry</p>");
      expect(out).not.toContain("&amp;amp;");
    });

    it("keeps &lt; and &gt; as-is after repeated saves", () => {
      let out = "<p>a &lt; b &gt; c</p>";
      for (let i = 0; i < 5; i++) out = sanitizeContent(out);
      expect(out).toBe("<p>a &lt; b &gt; c</p>");
      expect(out).not.toContain("&amp;lt;");
      expect(out).not.toContain("&amp;gt;");
    });

    it("does not double-escape a mix of entities, quotes and unicode", () => {
      const html = "<p>R&amp;D &lt;draft&gt; &quot;quoted&quot; caf\u00e9 \u20ac5 &amp;amp; literal</p>";
      const once = sanitizeContent(html);
      expect(sanitizeContent(sanitizeContent(once))).toBe(once);
      expect(once).toContain("&amp;amp; literal");
    });
  });
});
