import JSZip from "jszip";

/**
 * Conservative original-OOXML source map. This is a diagnostic stage, not a
 * Word parser or proof of conversion fidelity. It records source paragraph
 * order and text-run locations and fails closed on constructs it cannot map.
 */
const decode = text => text.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-fA-F]+|[0-9]+);/g, entity => {
  const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
  if (entity in named) return named[entity];
  const code = entity.startsWith("&#x") ? parseInt(entity.slice(3,-1),16) : parseInt(entity.slice(2,-1),10);
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
});
const location = (part, start, end) => ({ part, start, end });
export async function inspectDocxSourceMap(buffer) {
  const fail = errors => ({ ok: false, errors, paragraphs: [], imageReferences: [] });
  if (!Buffer.isBuffer(buffer) || !buffer.length) return fail(["DOCX must be a nonempty Buffer."]);
  let zip, xml;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    const file = zip.file("word/document.xml");
    if (!file) return fail(["Missing word/document.xml."]);
    xml = new TextDecoder("utf-8", { fatal: true }).decode(await file.async("uint8array"));
  } catch { return fail(["DOCX source XML is missing, corrupt, or not UTF-8."]); }
  const errors = [];
  // Reject ambiguous XML constructs rather than silently assigning wrong
  // offsets, including nested text containers and alternative content.
  if (/<w:(?:txbxContent|altChunk|sdt|ins|del|fldSimple|instrText|hyperlink|tab|br|cr|sym|noBreakHyphen|softHyphen)\b|<mc:AlternateContent\b/.test(xml)) {
    errors.push("Source map contains an unsupported or ambiguous text construct.");
  }
  const paragraphs = [];
  const imageReferences = [];
  const paraPattern = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
  for (const match of xml.matchAll(paraPattern)) {
    const start = match.index;
    const raw = match[0];
    const textRuns = [];
    const runPattern = /<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g;
    for (const run of raw.matchAll(runPattern)) {
      if (/<[^>]+>/.test(run[1])) errors.push(`Paragraph ${paragraphs.length + 1}: nested markup in text run.`);
      textRuns.push({ text: decode(run[1]), sourceLocation: location("word/document.xml", start + run.index, start + run.index + run[0].length) });
    }
    const images = [];
    for (const drawing of raw.matchAll(/<w:drawing(?=[\s>])[^>]*>[\s\S]*?<\/w:drawing>/g)) {
      const ids = [...drawing[0].matchAll(/<a:blip\b[^>]*\br:embed=["']([^"']+)["'][^>]*\/?\s*>/g)].map(x=>x[1]);
      if (!ids.length) errors.push(`Paragraph ${paragraphs.length + 1}: drawing without a mapped image reference.`);
      for (const relationshipId of ids) {
        const item = { relationshipId, paragraphIndex: paragraphs.length, sourceLocation: location("word/document.xml", start + drawing.index, start + drawing.index + drawing[0].length) };
        images.push(item);
        imageReferences.push(item);
      }
    }
    if (/<w:drawing\b/.test(raw) && !images.length) errors.push(`Paragraph ${paragraphs.length + 1}: unmapped drawing.`);
    paragraphs.push({
      index: paragraphs.length,
      sourceLocation: location("word/document.xml", start, start + raw.length),
      text: textRuns.map(run=>run.text).join(""),
      textRuns, images
    });
  }
  if (!paragraphs.length) errors.push("No source paragraphs could be mapped.");
  const count = [...xml.matchAll(/<w:p(?=[\s>])/g)].length;
  if (count !== paragraphs.length) errors.push("Source paragraph boundaries are ambiguous.");
  return errors.length ? fail([...new Set(errors)]) : { ok: true, errors: [], paragraphs, imageReferences };
}
