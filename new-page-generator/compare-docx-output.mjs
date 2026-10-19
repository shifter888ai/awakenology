/**
 * Conservative source-to-converted-HTML text and formatting gate.
 * Does not normalize whitespace, Unicode, punctuation or character variants.
 * Only accepts the restricted HTML vocabulary produced by the DOCX adapter.
 */
const decode = text => text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-fA-F]+|[0-9]+);/g, entity => {
  const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": "\u00a0" };
  if (entity in named) return named[entity];
  const code = entity.startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
    ? String.fromCodePoint(code) : entity;
});
export function compareDocxSourceToHtml(sourceMap, html) {
  const errors = [];
  if (!sourceMap?.ok || !Array.isArray(sourceMap.paragraphs)) return { ok: false, errors: ["Original DOCX source map has not passed."] };
  if (typeof html !== "string" || !html.trim()) return { ok: false, errors: ["Converted HTML is empty."] };
  // Unknown elements are blocked: otherwise hidden or discarded content could
  // falsely pass a text-only comparison.
  const allowed = new Set(["p","h1","h2","h3","h4","h5","h6","strong","b","em","i","u","s","a","ul","ol","li","table","thead","tbody","tr","td","th","br","img","blockquote","sup","sub","span"]);
  const tags = [...html.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>/gi)];
  for (const tag of tags) if (!allowed.has(tag[1].toLowerCase())) errors.push(`Unreviewed HTML element: ${tag[1]}.`);
  const stripped = html.replace(/<\/?[a-z][\w-]*\b[^>]*>/gi, "");
  if (/<|>/.test(stripped)) errors.push("Unparsed HTML markup remains after tokenization.");
  const actual = decode(stripped);
  const expected = sourceMap.paragraphs.map(p => p.text).join("");
  if (actual !== expected) {
    let offset = 0;
    while (offset < Math.min(actual.length, expected.length) && actual[offset] === expected[offset]) offset++;
    const sourceParagraph = sourceMap.paragraphs.find(p => {
      const previous = sourceMap.paragraphs.slice(0, p.index).reduce((sum, x) => sum + x.text.length, 0);
      return offset < previous + p.text.length;
    });
    errors.push(`Source/HTML text mismatch at UTF-16 offset ${offset}${sourceParagraph ? `; source paragraph ${sourceParagraph.index + 1}, XML offset ${sourceParagraph.sourceLocation.start}` : ""}. Exact characters, order and whitespace must match.`);
  }
  // Text comparison alone cannot detect a dropped or relocated image.
  // Compare each image's character offset in the concatenated text stream.
  const expectedImageOffsets = [];
  let imageSourceOffset = 0;
  for (const paragraph of sourceMap.paragraphs) {
    for (const item of paragraph.content ?? []) {
      if (item.type === "image") expectedImageOffsets.push(imageSourceOffset + (item.textOffset ?? 0));
    }
    imageSourceOffset += paragraph.text.length;
  }
  const actualImageOffsets = [...html.matchAll(/<img\b[^>]*\/?\s*>/gi)].map(match =>
    decode(html.slice(0, match.index).replace(/<\\/?[a-z][\\w-]*\\b[^>]*>/gi, "")).length
  );
  if (expectedImageOffsets.length !== actualImageOffsets.length ||
      expectedImageOffsets.some((offset, index) => offset !== actualImageOffsets[index])) {
    errors.push("Source/HTML image-position mismatch: expected offsets [" + expectedImageOffsets.join(", ") + "], actual offsets [" + actualImageOffsets.join(", ") + "].");
  }
  // Text comparison alone cannot detect a dropped or relocated Word line break.
  // Compare each break's character offset in the concatenated text stream.
  const expectedBreakOffsets = [];
  let sourceOffset = 0;
  for (const paragraph of sourceMap.paragraphs) {
    let paragraphOffset = 0;
    for (const item of paragraph.content ?? []) {
      if (item.type === "lineBreak") expectedBreakOffsets.push(sourceOffset + paragraphOffset);
      else if (item.type === "text" && typeof item.text === "string") paragraphOffset += item.text.length;
    }
    sourceOffset += paragraph.text.length;
  }
  const actualBreakOffsets = [...html.matchAll(/<br\b[^>]*\/?\s*>/gi)].map(match =>
    decode(html.slice(0, match.index).replace(/<\/?[a-z][\w-]*\b[^>]*>/gi, "")).length
  );
  if (expectedBreakOffsets.length !== actualBreakOffsets.length ||
      expectedBreakOffsets.some((offset, index) => offset !== actualBreakOffsets[index])) {
    errors.push(`Source/HTML line-break mismatch: expected offsets [${expectedBreakOffsets.join(", ")}], actual offsets [${actualBreakOffsets.join(", ")}].`);
  }
  return { ok: errors.length === 0, errors, expectedLength: expected.length, actualLength: actual.length };
}
