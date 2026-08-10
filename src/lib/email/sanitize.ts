import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "html", "head", "body", "main", "section", "article", "header", "footer", "p", "br", "div", "span", "center",
  "strong", "b", "em", "i", "u", "s", "small", "sub", "sup", "blockquote", "ul", "ol", "li", "a", "img",
  "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "h1", "h2", "h3", "h4", "h5", "h6"
];

const safeStyleValue = /^(?!.*(?:expression|javascript|url\s*\())[-#(),.%\w\s"'/:]+$/i;
const allowedStyles = {
  "*": Object.fromEntries(Object.entries({
    "background": safeStyleValue,
    "background-color": safeStyleValue,
    "border": safeStyleValue,
    "border-bottom": safeStyleValue,
    "border-collapse": safeStyleValue,
    "border-color": safeStyleValue,
    "border-left": safeStyleValue,
    "border-radius": safeStyleValue,
    "border-right": safeStyleValue,
    "border-spacing": safeStyleValue,
    "border-style": safeStyleValue,
    "border-top": safeStyleValue,
    "border-width": safeStyleValue,
    "box-sizing": safeStyleValue,
    "color": safeStyleValue,
    "direction": /^(ltr|rtl)$/i,
    "display": /^(block|inline|inline-block|table|table-row|table-cell|none)$/i,
    "font": safeStyleValue,
    "font-family": safeStyleValue,
    "font-size": safeStyleValue,
    "font-style": safeStyleValue,
    "font-weight": safeStyleValue,
    "height": safeStyleValue,
    "letter-spacing": safeStyleValue,
    "line-height": safeStyleValue,
    "margin": safeStyleValue,
    "margin-bottom": safeStyleValue,
    "margin-left": safeStyleValue,
    "margin-right": safeStyleValue,
    "margin-top": safeStyleValue,
    "max-height": safeStyleValue,
    "max-width": safeStyleValue,
    "min-height": safeStyleValue,
    "min-width": safeStyleValue,
    "opacity": /^(0|0?\.\d+|1(?:\.0+)?)$/,
    "overflow": /^(auto|hidden|scroll|visible)$/i,
    "padding": safeStyleValue,
    "padding-bottom": safeStyleValue,
    "padding-left": safeStyleValue,
    "padding-right": safeStyleValue,
    "padding-top": safeStyleValue,
    "text-align": /^(left|right|center|justify|start|end)$/i,
    "text-decoration": safeStyleValue,
    "text-transform": /^(none|capitalize|uppercase|lowercase)$/i,
    "vertical-align": safeStyleValue,
    "white-space": /^(normal|nowrap|pre|pre-line|pre-wrap)$/i,
    "width": safeStyleValue,
    "word-break": /^(normal|break-all|keep-all|break-word)$/i,
    "word-wrap": /^(normal|break-word)$/i
  }).map(([property, pattern]) => [property, [pattern]]))
};

const baseOptions: sanitizeHtml.IOptions = {
  allowedTags,
  allowedAttributes: {
    "*": ["style", "class", "id", "dir", "lang", "title", "align", "valign", "width", "height", "bgcolor"],
    a: ["href", "target", "rel", "name"],
    img: ["src", "alt", "title", "width", "height", "style", "class", "data-remote-src", "data-remote-image"],
    table: ["role", "width", "height", "border", "cellpadding", "cellspacing", "align", "bgcolor", "style", "class"],
    td: ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor", "style", "class"],
    th: ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor", "style", "class"],
    col: ["span", "width", "style", "class"]
  },
  allowedStyles,
  allowedSchemes: ["http", "https", "mailto", "cid"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (_tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
    form: () => ({ tagName: "div", attribs: {}, text: "[Interactive content removed]" })
  }
};

export function sanitizeImportedEmailHtml(value: string) {
  return sanitizeHtml(value, {
    ...baseOptions,
    transformTags: {
      ...baseOptions.transformTags,
      img: (_tagName, attribs) => {
        const src = attribs.src?.trim() || "";
        if (/^cid:/i.test(src)) return { tagName: "img", attribs };
        if (/^https?:\/\//i.test(src)) {
          const { src: _src, ...safeAttributes } = attribs;
          return { tagName: "img", attribs: { ...safeAttributes, "data-remote-src": src, "data-remote-image": "true" } };
        }
        return { tagName: "span", attribs: {}, text: attribs.alt ? `[Image: ${attribs.alt}]` : "[Image removed]" };
      }
    }
  });
}

export function sanitizeAdminEmailHtml(value: string) {
  return sanitizeHtml(value, {
    ...baseOptions,
    allowedTags: allowedTags.filter((tag) => !["html", "head", "body"].includes(tag)),
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      ...baseOptions.transformTags,
      img: (_tagName, attribs) => {
        const src = attribs.src?.trim() || "";
        if (!/^https:\/\//i.test(src)) return { tagName: "span", attribs: {}, text: attribs.alt ? `[Image: ${attribs.alt}]` : "[Image removed]" };
        return { tagName: "img", attribs: { ...attribs, src } };
      }
    }
  });
}
