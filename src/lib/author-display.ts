export function authorInitials(name: string) {
  const cleaned = name.replace(/\bet al\.?/gi, "").trim();
  const [surnamePart, givenPart] = cleaned.includes(",")
    ? cleaned.split(/,\s*/, 2)
    : [cleaned.split(/\s+/).at(-1) || "", cleaned.split(/\s+/)[0] || ""];
  return `${surnamePart.match(/[\p{L}\p{N}]/u)?.[0] || ""}${givenPart.match(/[\p{L}\p{N}]/u)?.[0] || ""}`.toLocaleUpperCase();
}

const PORTRAIT_COLORS = ["#1d5b47", "#8b452f", "#31556d", "#6b4a78", "#79602e", "#27636a"];

export function portraitColor(name: string) {
  return PORTRAIT_COLORS[Array.from(name).reduce((sum, character) => sum + (character.codePointAt(0) || 0), 0) % PORTRAIT_COLORS.length];
}
