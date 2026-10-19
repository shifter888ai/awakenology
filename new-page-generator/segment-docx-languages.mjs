/**
 * Finds the three authored language-section boundaries in the known trilingual
 * pilot DOCX. This is an inventory-only aid: it does not translate, rewrite,
 * render, or authorize output. Each segment is a half-open paragraph range.
 */
export const PILOT_LANGUAGE_MARKERS = Object.freeze([
  { language: "zh-Hant", marker: "多重時空是什麽" },
  { language: "en", marker: "What is Multidimensional Space-Time" },
  { language: "ja", marker: "多重時空とは" }
]);

export function segmentTrilingualDocxSource(sourceMap, markers = PILOT_LANGUAGE_MARKERS) {
  if (!sourceMap?.ok || !Array.isArray(sourceMap.paragraphs) || !sourceMap.paragraphs.length) {
    return { ok: false, errors: ["A successful ordered DOCX source map is required."], segments: [] };
  }
  if (!Array.isArray(markers) || markers.length !== 3 ||
      markers.some(item => !item || typeof item.language !== "string" || typeof item.marker !== "string" || !item.marker.trim()) ||
      new Set(markers.map(item => item.language)).size !== 3) {
    return { ok: false, errors: ["Exactly three unique language markers are required."], segments: [] };
  }
  const errors = [];
  const boundaries = markers.map(item => {
    const matches = [];
    sourceMap.paragraphs.forEach((paragraph, index) => {
      if (String(paragraph.text ?? "").trim().includes(item.marker)) matches.push(index);
    });
    if (matches.length !== 1) errors.push(item.language + ": expected exactly one paragraph containing title marker " + JSON.stringify(item.marker) + ", found " + matches.length + ".");
    return { ...item, paragraphIndex: matches.length === 1 ? matches[0] : null, matches };
  });
  if (errors.length) return { ok: false, errors, segments: [], boundaries };
  for (let i = 1; i < boundaries.length; i++) {
    if (boundaries[i].paragraphIndex <= boundaries[i - 1].paragraphIndex) {
      errors.push("Language title markers are not in the expected source order: " + boundaries[i - 1].language + " before " + boundaries[i].language + ".");
    }
  }
  if (errors.length) return { ok: false, errors, segments: [], boundaries };
  const segments = boundaries.map((item, index) => {
    const startParagraph = item.paragraphIndex;
    const endParagraphExclusive = boundaries[index + 1]?.paragraphIndex ?? sourceMap.paragraphs.length;
    const paragraphs = sourceMap.paragraphs.slice(startParagraph, endParagraphExclusive);
    return {
      language: item.language,
      marker: item.marker,
      startParagraph,
      endParagraphExclusive,
      paragraphCount: paragraphs.length,
      paragraphs,
      imageReferences: paragraphs.flatMap(paragraph => paragraph.images ?? [])
    };
  });
  return { ok: true, errors: [], segments, boundaries: boundaries.map(({ language, marker, paragraphIndex }) => ({ language, marker, paragraphIndex })) };
}
