// sanitize-html allowlist: p, h1-h3, strong, em, u, ul, ol, li, br (no attributes, images, links, styles)
import sanitizeHtml from "sanitize-html";

export const ALLOWED_TAGS = ["p", "h1", "h2", "h3", "strong", "em", "u", "ul", "ol", "li", "br"];

/**
 * Sanitizes document HTML. Disallowed tags are unwrapped (their text is kept), except
 * script/style/textarea/option whose contents are dropped entirely (sanitize-html default).
 * All attributes are removed.
 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}
