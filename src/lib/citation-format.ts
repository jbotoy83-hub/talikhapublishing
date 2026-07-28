import type { Publication } from "./types";

function year(date: string) {
  const m = date.match(/^(\d{4})/);
  return m ? m[1] : date;
}

function parsePages(pages?: string) {
  if (!pages) return { start: "", end: "" };
  const parts = pages.split(/[-–—]/).map((s) => s.trim());
  return { start: parts[0] || "", end: parts[1] || "" };
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() + ".").join(" ");
}

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

function firstName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, -1).join(" ");
}

function doiUrl(doi?: string) {
  if (!doi) return "";
  return `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}`;
}

function authorListApa(authors: { name: string }[]) {
  if (!authors.length) return "";
  if (authors.length === 1) return `${lastName(authors[0].name)}, ${initials(firstName(authors[0].name))}`;
  if (authors.length === 2) return `${lastName(authors[0].name)}, ${initials(firstName(authors[0].name))}, & ${lastName(authors[1].name)}, ${initials(firstName(authors[1].name))}`;
  const all = authors.map((a) => `${lastName(a.name)}, ${initials(firstName(a.name))}`);
  return `${all.slice(0, -1).join(", ")}, & ${all[all.length - 1]}`;
}

function authorListMla(authors: { name: string }[]) {
  if (!authors.length) return "";
  if (authors.length === 1) return authors[0].name;
  if (authors.length === 2) return `${authors[0].name}, and ${authors[1].name}`;
  return `${authors[0].name}, et al`;
}

function authorListChicago(authors: { name: string }[]) {
  if (!authors.length) return "";
  if (authors.length === 1) return authors[0].name;
  if (authors.length === 2) return `${authors[0].name}, and ${authors[1].name}`;
  const all = authors.map((a) => a.name);
  return `${all.slice(0, -1).join(", ")}, and ${all[all.length - 1]}`;
}

export function formatApa(p: Publication) {
  const y = year(p.publicationDate);
  const d = doiUrl(p.doi);
  const authors = p.authors.length ? p.authors : p.authorDisplay.split(";").map((n) => ({ name: n.trim() })).filter((a) => a.name);
  const parts = [authorListApa(authors), ` (${y}).`, ` ${p.title}.`, ` *${p.journal.title}*`];
  if (p.volume) parts[parts.length - 1] += `, *${p.volume}*`;
  if (p.issue) parts[parts.length - 1] += `(${p.issue})`;
  if (p.pages) parts.push(`, ${p.pages}`);
  parts.push(".");
  if (d) parts.push(` ${d}`);
  return parts.join("");
}

export function formatMla(p: Publication) {
  const y = year(p.publicationDate);
  const d = doiUrl(p.doi);
  const authors = p.authors.length ? p.authors : p.authorDisplay.split(";").map((n) => ({ name: n.trim() })).filter((a) => a.name);
  const parts = [`${authorListMla(authors)}.`, ` "${p.title}."`, ` *${p.journal.title}*`];
  if (p.volume) parts.push(`, vol. ${p.volume}`);
  if (p.issue) parts.push(`, no. ${p.issue}`);
  parts.push(`, ${y}`);
  if (p.pages) parts.push(`, pp. ${p.pages}`);
  parts.push(".");
  if (d) parts.push(` *${d}*.`);
  return parts.join("");
}

export function formatChicago(p: Publication) {
  const y = year(p.publicationDate);
  const d = doiUrl(p.doi);
  const authors = p.authors.length ? p.authors : p.authorDisplay.split(";").map((n) => ({ name: n.trim() })).filter((a) => a.name);
  const parts = [`${authorListChicago(authors)}.`, ` "${p.title}."`, ` *${p.journal.title}*`];
  if (p.volume) parts.push(` ${p.volume}`);
  if (p.issue) parts.push(`, no. ${p.issue}`);
  parts.push(` (${y})`);
  if (p.pages) parts.push(`: ${p.pages}`);
  parts.push(".");
  if (d) parts.push(` ${d}.`);
  return parts.join("");
}

export function formatBibtex(p: Publication) {
  const y = year(p.publicationDate);
  const authors = p.authors.length ? p.authors : p.authorDisplay.split(";").map((n) => ({ name: n.trim() })).filter((a) => a.name);
  const key = `${lastName(authors[0]?.name || "unknown")}${y}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const authorStr = authors.map((a) => `${lastName(a.name)}, ${firstName(a.name)}`).join(" and ");
  const lines = [`@article{${key},`, `  author = {${authorStr}},`, `  title = {${p.title}},`, `  journal = {${p.journal.title}},`];
  if (p.volume) lines.push(`  volume = {${p.volume}},`);
  if (p.issue) lines.push(`  number = {${p.issue}},`);
  if (p.pages) lines.push(`  pages = {${p.pages.replace(/[-–—]/, "--")}},`);
  lines.push(`  year = {${y}},`);
  if (p.doi) lines.push(`  doi = {${p.doi}},`);
  lines.push("}");
  return lines.join("\n");
}

export function formatRis(p: Publication) {
  const y = year(p.publicationDate);
  const authors = p.authors.length ? p.authors : p.authorDisplay.split(";").map((n) => ({ name: n.trim() })).filter((a) => a.name);
  const { start, end } = parsePages(p.pages);
  const lines = ["TY  - JOUR"];
  for (const a of authors) lines.push(`AU  - ${lastName(a.name)}, ${firstName(a.name)}`);
  lines.push(`TI  - ${p.title}`, `JO  - ${p.journal.title}`);
  if (p.volume) lines.push(`VL  - ${p.volume}`);
  if (p.issue) lines.push(`IS  - ${p.issue}`);
  if (start) lines.push(`SP  - ${start}`);
  if (end) lines.push(`EP  - ${end}`);
  lines.push(`PY  - ${y}`);
  if (p.doi) lines.push(`DO  - ${p.doi}`);
  lines.push("ER  -");
  return lines.join("\n");
}

export function isOpenAccess(licenseName: string) {
  return /creative\s*commons|^cc\s/i.test(licenseName);
}

export function ccType(licenseName: string) {
  const m = licenseName.match(/cc\s*(by(?:-nc(?:-nd|-sa)?|-nd|-sa)?)/i);
  return m ? m[1].toUpperCase().replace(/-/g, "-") : null;
}
