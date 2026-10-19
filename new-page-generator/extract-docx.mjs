import JSZip from "jszip";
import mammoth from "mammoth";
import { createHash } from "node:crypto";
import { inspectDocxAssets } from "./inspect-docx-assets.mjs";
import { inspectDocxSourceMap } from "./inspect-docx-source-map.mjs";
import { compareDocxSourceToHtml } from "./compare-docx-output.mjs";

/**
 * Conservative offline DOCX extraction. Output is intermediate HTML only.
 * Complex or ambiguous Word constructs are blocked for manual review.
 */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENT_XML_BYTES = 20 * 1024 * 1024;
const MAX_STYLES_XML_BYTES = 5 * 1024 * 1024;
const FEATURES = [
  ["unsupported run effects or hidden text", /<w:(?:vertAlign|position|vanish|specVanish|smallCaps|emboss|imprint|shadow|outline|effect|fitText|rtl|cs)(?:\s|\/?>)/],
  ["paragraph pagination, direction, or section layout", /<w:(?:sectPr|pageBreakBefore|keepNext|keepLines|widowControl|outlineLvl|contextualSpacing|bidi|textDirection|mirrorIndents|snapToGrid|adjustRightInd|autoSpaceDE|autoSpaceDN)(?:\s|\/?>)/],
  ["paragraph numbering or list semantics", /<w:numPr(?:\s|\/?>)/],
  ["Word table structure (requires cell/order/merge fidelity mapping)", /<w:tbl(?:\s|\/?>)/],
  ["highlight or shading (requires lossless mapping)", /<w:(?:highlight|shd)(?:\s|>)/],
  ["tracked insertion", /<w:ins(?:\s|>)/],
  ["tracked deletion", /<w:del(?:\s|>)/],
  ["comment range", /<w:commentRangeStart(?:\s|>)/],
  ["text box", /<w:txbxContent(?:\s|>)/],
  ["floating drawing", /<wp:anchor(?:\s|>)/],
  ["field instruction", /<w:instrText(?:\s|>)/],
  ["equation", /<m:oMath(?:\s|>)/],
  ["embedded object", /<w:object(?:\s|>)|<o:OLEObject(?:\s|>)/],
  ["footnote reference", /<w:footnoteReference(?:\s|>)/],
  ["endnote reference", /<w:endnoteReference(?:\s|>)/]
];
const xmlText = bytes => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const digest = buffer => createHash("sha256").update(buffer).digest("hex");
const blocked = (errors, buffer) => ({
  ok: false, errors, html: null,
  ...(Buffer.isBuffer(buffer) ? { sha256: digest(buffer) } : {})
});

export async function extractDocx(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return blocked(["DOCX must be a nonempty Buffer."], buffer);
  }
  if (buffer.length > MAX_INPUT_BYTES) {
    return blocked([`DOCX exceeds the ${MAX_INPUT_BYTES / 1024 / 1024} MiB input limit.`], buffer);
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch {
    return blocked(["Invalid or corrupt DOCX ZIP package."], buffer);
  }

  const errors = [];
  const required = ["[Content_Types].xml", "word/document.xml", "word/_rels/document.xml.rels"];
  for (const path of required) if (!zip.file(path)) errors.push(`Missing required DOCX part: ${path}.`);
  if (errors.length) return blocked(errors, buffer);

  let xml;
  try {
    const xmlBytes = await zip.file("word/document.xml").async("uint8array");
    if (xmlBytes.byteLength > MAX_DOCUMENT_XML_BYTES) {
      return blocked([`word/document.xml exceeds the ${MAX_DOCUMENT_XML_BYTES / 1024 / 1024} MiB limit.`], buffer);
    }
    xml = xmlText(xmlBytes);
  } catch {
    return blocked(["word/document.xml is unreadable or is not valid UTF-8."], buffer);
  }

  for (const [name, pattern] of FEATURES) {
    if (pattern.test(xml)) errors.push(`Unsupported or ambiguous Word feature: ${name}.`);
  }
  // Document defaults and named styles can affect runs without any direct formatting
  // in document.xml. Until inherited typography is rendered and compared end-to-end,
  // never let an otherwise plain-looking document bypass the conversion gate.
  const stylesPart = zip.file("word/styles.xml");
  if (stylesPart) {
    let stylesXml;
    try {
      const styleBytes = await stylesPart.async("uint8array");
      if (styleBytes.byteLength > MAX_STYLES_XML_BYTES) errors.push("Word styles part exceeds the 5 MiB limit.");
      else stylesXml = xmlText(styleBytes);
    } catch { errors.push("Word styles part is unreadable or is not valid UTF-8."); }
    if (stylesXml) {
      for (const [name, pattern] of FEATURES) {
        if (pattern.test(stylesXml)) errors.push(`Unsupported or ambiguous inherited Word feature: ${name}.`);
      }
    }
  }
  if (zip.file("word/comments.xml")) errors.push("Word comments require manual resolution.");
  if (zip.file("word/footnotes.xml")) errors.push("Footnotes require manual resolution.");
  if (zip.file("word/endnotes.xml")) errors.push("Endnotes require manual resolution.");
  if (/<w:altChunk(?:\s|>)/.test(xml)) errors.push("Alternative content chunks require manual resolution.");
  const hasDrawings = /<w:drawing(?:\s|\/?>)/.test(xml) || /<w:pict(?:\s|\/?>)/.test(xml);
  let assets = [];
  if (hasDrawings) {
    const inspected = await inspectDocxAssets(buffer);
    if (!inspected.ok) errors.push(...inspected.errors.map(error => `DOCX image adapter: ${error}`));
    else assets = inspected.assets;
  }

  if (errors.length) return blocked(errors, buffer);
  const sourceMap = await inspectDocxSourceMap(buffer);
  if (!sourceMap.ok) return blocked(sourceMap.errors.map(error => `DOCX source map: ${error}`), buffer);
  const rich = await inspectDocxRichContent(buffer);
  if (!rich.ok) return blocked(rich.errors.map(error => `DOCX rich content: ${error}`), buffer);
  if (assets.length !== sourceMap.imageReferences.length) {
    return blocked(["DOCX source map image count differs from extracted asset count."], buffer);
  }
  for (let i = 0; i < assets.length; i++) {
    if (assets[i].relationshipId !== sourceMap.imageReferences[i].relationshipId) {
      return blocked([`DOCX image source order mismatch at position ${i + 1}.`], buffer);
    }
  }

  try {
    const assetByHash = new Map(assets.map(asset => [asset.sha256, asset]));
    const converted = await mammoth.convertToHtml({ buffer }, {
      styleMap: ["u => u", "strike => s"],
      includeDefaultStyleMap: true,
      convertImage: mammoth.images.imgElement(async image => {
        const base64 = await image.read("base64");
        const checksum = digest(Buffer.from(base64, "base64"));
        const asset = assetByHash.get(checksum);
        if (!asset) throw new Error("Converted image does not match an inspected DOCX asset.");
        return { src: asset.outputPath, alt: asset.altText };
      })
    });
    errors.push(...converted.messages.map(m => `DOCX parser ${m.type}: ${m.message}`));
    if (!converted.value?.trim()) errors.push("DOCX converted to empty HTML.");
    let formattedHtml = converted.value;
    if (converted.value?.trim()) {
      const formatted = applyDocxRichFormatting(converted.value, rich);
      if (!formatted.ok) errors.push(...formatted.errors.map(error => `DOCX rich formatting: ${error}`));
      else formattedHtml = formatted.html;
      errors.push(...compareDocxSourceToHtml(sourceMap, formattedHtml).errors.map(error => `DOCX text integrity: ${error}`));
    }
    for (const asset of assets) {
      if (!converted.value.includes(asset.outputPath)) errors.push(`Inspected image was not preserved in converted HTML: ${asset.outputPath}.`);
    }
    return {
      ok: errors.length === 0, errors, html: errors.length ? null : formattedHtml,
      sha256: digest(buffer), sourceMap: errors.length ? null : sourceMap, assets: errors.length ? [] : assets.map(({ bytes, ...asset }) => asset)
    };
  } catch (error) {
    return blocked([`DOCX conversion failed: ${error.message}`], buffer);
  }
}
