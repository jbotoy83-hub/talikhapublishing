import sanitizeHtml from "sanitize-html";

export function sanitizeImportedEmailHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "blockquote", "ul", "ol", "li", "a", "table", "thead", "tbody", "tr", "th", "td", "hr", "h1", "h2", "h3", "h4"],
    allowedAttributes: { a: ["href", "title"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
    transformTags: { img: () => ({ tagName: "span", attribs: {}, text: "[Remote image blocked]" }), form: () => ({ tagName: "div", attribs: {}, text: "[Form removed]" }) }
  });
}
