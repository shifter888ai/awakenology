import JSZip from "jszip";
import mammoth from "mammoth";
import { createHash } from "node:crypto";

/**
 * First real DOCX extraction stage, Node-only, offline. Returns HTML for the
 * separate paste inspector, never directly publishable markup.
 * Deliberately blocks ambiguous Word features and all parser warnings.
 */
const FEATURES = [
  ["explicit Word text color (requires lossless color mapping)", /<w:color(?:\s|>)/],
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
export async function extractDocx(buffer) {
  const errors = [];
  if (!Buffer.isBuffer(buffer) || !buffer.length) return { ok: false, errors: ["DOCX must be a nonempty Buffer."], html: null };
  let zip;
  try { zip = await JSZip.loadAsync(buffer, { checkCRC32: true }); }
  catch { return { ok: false, errors: ["Invalid or corrupt DOCX ZIP package."], html: null }; }
  const required = ["[Content_Types].xml", "word/document.xml", "word/_rels/document.xml.rels"];
  for (const path of required) if (!zip.file(path)) errors.push(`Missing required DOCX part: ${path}.`);
  if (errors.length) return { ok: false, errors, html: null };
  const xml = await zip.file("word/document.xml").async("uint8array").then(xmlText);
  for (const [name, pattern] of FEATURES) if (pattern.test(xml)) errors.push(`Unsupported or ambiguous Word feature: ${name}.`);
  if (zip.file("word/comments.xml")) errors.push("Word comments require manual resolution.");
  if (zip.file("word/footnotes.xml")) errors.push("Footnotes require manual resolution.");
  if (zip.file("word/endnotes.xml")) errors.push("Endnotes require manual resolution.");
  if (/<w:altChunk(?:\s|>)/.test(xml)) errors.push("Alternative content chunks require manual resolution.");
  if (/<w:drawing(?:\s|>)/.test(xml) || /<w:pict(?:\s|>)/.test(xml)) errors.push("Embedded drawings/images require separate asset extraction and review.");
  if (/<w:tbl(?:\s|>)/.test(xml) && /<w:(?:gridSpan|vMerge)(?:\s|>)/.test(xml)) errors.push("Merged table cells require explicit review.");
  // Conversion is attempted only for a package with no known blockers.
  if (errors.length) return { ok: false, errors, html: null, sha256: createHash("sha256").update(buffer).digest("hex") };
  try {
    const converted = await mammoth.convertToHtml({ buffer }, {
      styleMap: ["u => u", "strike => s"],
      includeDefaultStyleMap: true
    });
    errors.push(...converted.messages.map(m => `DOCX parser ${m.type}: ${m.message}`));
    if (!converted.value?.trim()) errors.push("DOCX converted to empty HTML.");
    return {
      ok: errors.length === 0,
      errors,
      html: errors.length ? null : converted.value,
      sha256: createHash("sha256").update(buffer).digest("hex")
    };
  } catch (error) {
    return { ok: false, errors: [`DOCX conversion failed: ${error.message}`], html: null };
  }
}
