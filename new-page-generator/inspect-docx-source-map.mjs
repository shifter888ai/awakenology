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
  if (/<w:(?:txbxContent|altChunk|sdt|ins|del|fldSimple|instrText|hyperlink|tab|cr|sym|noBreakHyphen|softHyphen)\b|<mc:AlternateContent\b/.test(xml)) {
    errors.push("Source map contains an unsupported or ambiguous text construct.");
  }
  const paragraphs = [];
  const imageReferences = [];
  const paraPattern = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
  for (const match of xml.matchAll(paraPattern)) {
    const start = match.index;
    const raw = match[0];
    const textRuns = [];
    const breaks = [];
    const content = [];
    const runPattern = /<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g;
    for (const run of raw.matchAll(runPattern)) {
      if (/<[^>]+>/.test(run[1])) errors.push(`Paragraph ${paragraphs.length + 1}: nested markup in text run.`);
      const item = { type: "text", text: decode(run[1]), sourceLocation: location("word/document.xml", start + run.index, start + run.index + run[0].length) };
      textRuns.push({ text: item.text, sourceLocation: item.sourceLocation });
      content.push({ ...item, sourceOffset: run.index });
    }
    // Only Word's explicit text-wrapping break is mapped here. Page/column
    // breaks and other controls remain unsupported and fail closed.
    for (const br of raw.matchAll(/<w:br(?=[\s/>])[^>]*\/?\s*>/g)) {
      const tag = br[0];
      const type = /\bw:type=["']([^"']+)["']/.exec(tag)?.[1] ?? "textWrapping";
      if (type !== "textWrapping") {
        errors.push(`Paragraph ${paragraphs.length + 1}: unsupported Word break type "${type}".`);
        continue;
      }
      const item = { type: "lineBreak", breakType: type, sourceLocation: location("word/document.xml", start + br.index, start + br.index + tag.length) };
      breaks.push(item);
      content.push({ ...item, sourceOffset: br.index });
    }
    content.sort((a,b) => a.sourceOffset - b.sourceOffset);
    const images = [];
    for (const drawing of raw.matchAll(/<w:drawing(?=[\s>])[^>]*>[\s\S]*?<\/w:drawing>/g)) {
      const ids = [...drawing[0].matchAll(/<a:blip\b[^>]*\br:embed=["']([^"']+)["'][^>]*\/?\s*>/g)].map(x=>x[1]);
      if (!ids.length) errors.push(`Paragraph ${paragraphs.length + 1}: drawing without a mapped image reference.`);
      const inline = /<wp:inline\b/.test(drawing[0]);
      const anchorMatch = /<wp:anchor\b[^>]*>[\s\S]*?<\/wp:anchor>/.exec(drawing[0]);
      const anchor = anchorMatch?.[0] ?? null;
      const tagAttrs = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=["']([^"']*)["']/g)].map(m=>[m[1],m[2]]));
      const docPrTag = anchor?.match(/<wp:docPr\b[^>]*\/?\s*>/)?.[0] ?? null;
      const placement = anchor ? {
        kind: "floating",
        anchorAttributes: tagAttrs(anchor.match(/^<wp:anchor\b[^>]*>/)?.[0] ?? ""),
        docPr: docPrTag ? tagAttrs(docPrTag) : {},
        horizontalPosition: anchor.match(/<wp:positionH\b[^>]*>[\s\S]*?<\/wp:positionH>/)?.[0] ?? null,
        verticalPosition: anchor.match(/<wp:positionV\b[^>]*>[\s\S]*?<\/wp:positionV>/)?.[0] ?? null,
        wrap: anchor.match(/<wp:wrap\w+\b[^>]*\/?\s*>/)?.[0] ?? null
      } : { kind: inline ? "inline" : "unknown" };
      for (const relationshipId of ids) {
        const item = { relationshipId, paragraphIndex: paragraphs.length, placement, sourceLocation: location("word/document.xml", start + drawing.index, start + drawing.index + drawing[0].length) };
        images.push(item);
        imageReferences.push(item);
        content.push({type:"image",relationshipId,sourceLocation:item.sourceLocation,sourceOffset:drawing.index});
      }
    }
    content.sort((a,b) => a.sourceOffset - b.sourceOffset);
    if (/<w:drawing\b/.test(raw) && !images.length) errors.push(`Paragraph ${paragraphs.length + 1}: unmapped drawing.`);
    paragraphs.push({
      index: paragraphs.length,
      sourceLocation: location("word/document.xml", start, start + raw.length),
      text: textRuns.map(run=>run.text).join(""),
      textRuns, breaks, content: content.map(({sourceOffset, ...item}) => item), images
    });
  }
  if (!paragraphs.length) errors.push("No source paragraphs could be mapped.");
  const count = [...xml.matchAll(/<w:p(?=[\s>])/g)].length;
  if (count !== paragraphs.length) errors.push("Source paragraph boundaries are ambiguous.");
  return errors.length ? fail([...new Set(errors)]) : { ok: true, errors: [], paragraphs, imageReferences };
}
