import JSZip from "jszip";
import { createHash } from "node:crypto";
import { posix } from "node:path";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const decodeXml = value => value
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const attributes = source => Object.fromEntries(
  [...source.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)]
    .map(m => [m[1], decodeXml(m[3] ?? m[4] ?? "")])
);
const attr = (tag, name) => attributes(tag)[name];

/**
 * Inspect and extract embedded image parts from inline or floating DOCX drawings.
 * Floating placement metadata is retained for manual visual review; it is never
 * converted to inline flow. VML, linked images and unsupported drawing content
 * remain blocked rather than silently omitted.
 */
export async function inspectDocxAssets(buffer) {
  const fail = errors => ({ ok: false, errors, assets: [] });
  if (!Buffer.isBuffer(buffer) || !buffer.length) return fail(["DOCX must be a nonempty Buffer."]);

  let zip;
  try { zip = await JSZip.loadAsync(buffer, { checkCRC32: true }); }
  catch { return fail(["Invalid or corrupt DOCX ZIP package."]); }

  const documentFile = zip.file("word/document.xml");
  const relsFile = zip.file("word/_rels/document.xml.rels");
  const typesFile = zip.file("[Content_Types].xml");
  if (!documentFile || !relsFile || !typesFile) {
    return fail(["Missing document XML, document relationships, or content types."]);
  }

  let xml, relsXml, typesXml;
  try {
    [xml, relsXml, typesXml] = await Promise.all([
      documentFile.async("string"), relsFile.async("string"), typesFile.async("string")
    ]);
  } catch { return fail(["Unable to read DOCX XML parts."]); }

  const errors = [];
  const relationships = new Map();
  for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const a = attributes(match[1]);
    if (!a.Id || !a.Type || !a.Target) {
      errors.push("Malformed document relationship.");
      continue;
    }
    relationships.set(a.Id, a);
  }

  const defaults = new Map();
  const overrides = new Map();
  for (const match of typesXml.matchAll(/<(Default|Override)\b([^>]*)\/?\s*>/g)) {
    const a = attributes(match[2]);
    if (match[1] === "Default" && a.Extension && a.ContentType) defaults.set(a.Extension.toLowerCase(), a.ContentType);
    if (match[1] === "Override" && a.PartName && a.ContentType) overrides.set(a.PartName.replace(/^\//, ""), a.ContentType);
  }

  if (/<w:pict\b/.test(xml) || /<v:imagedata\b/.test(xml)) errors.push("VML pictures require a separate adapter.");
  if (/<c:chart\b|<mc:AlternateContent\b|<w:object\b|<o:OLEObject\b/.test(xml)) {
    errors.push("Charts, embedded objects, or alternate drawing content require manual review.");
  }

  const drawingCount = [...xml.matchAll(/<w:drawing\b/g)].length;
  const drawingBlocks = [...xml.matchAll(/<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/g)];
  if (drawingCount !== drawingBlocks.length) errors.push("A Word drawing block could not be parsed safely.");
  const imageRefs = [];
  for (const drawing of drawingBlocks) {
    const rawDrawing = drawing[0];
    const inline = [...rawDrawing.matchAll(/<wp:inline\b[^>]*>[\s\S]*?<\/wp:inline>/g)];
    const anchors = [...rawDrawing.matchAll(/<wp:anchor\b[^>]*>[\s\S]*?<\/wp:anchor>/g)];
    if (inline.length + anchors.length !== 1) {
      errors.push("Drawing must contain exactly one recognized inline or floating placement.");
      continue;
    }
    const isAnchor = anchors.length === 1;
    const block = (isAnchor ? anchors[0] : inline[0])[0];
    const blockBlips = [...block.matchAll(/<a:blip\b[^>]*\/?\s*>/g)];
    if (!blockBlips.length) errors.push("A drawing contains no recognized image; shape content requires review.");
    const tagAttrs = tag => attributes(tag);
    const docPr = block.match(/<wp:docPr\b[^>]*\/?\s*>/)?.[0] ?? null;
    const placement = isAnchor ? {
      kind: "floating",
      anchorAttributes: tagAttrs(block.match(/^<wp:anchor\b[^>]*>/)?.[0] ?? ""),
      docPr: docPr ? tagAttrs(docPr) : {},
      horizontalPosition: block.match(/<wp:positionH\b[^>]*>[\s\S]*?<\/wp:positionH>/)?.[0] ?? null,
      verticalPosition: block.match(/<wp:positionV\b[^>]*>[\s\S]*?<\/wp:positionV>/)?.[0] ?? null,
      extent: block.match(/<wp:extent\b[^>]*\/?\s*>/)?.[0] ?? null,
      wrap: block.match(/<wp:wrap\w+\b[^>]*\/?\s*>/)?.[0] ?? null,
      requiresVisualReview: true
    } : { kind: "inline", requiresVisualReview: false };
    for (const blip of blockBlips) {
      const tag = blip[0];
      if (attr(tag, "r:link")) errors.push("Externally linked image is unsupported.");
      const id = attr(tag, "r:embed");
      if (!id) errors.push("Image has no embedded relationship ID.");
      else imageRefs.push({ id, block, placement, sourceOffset: drawing.index });
    }
  }
  const allBlips = [...xml.matchAll(/<a:blip\b[^>]*\/?\s*>/g)];
  if (allBlips.length !== imageRefs.length) errors.push("An image reference occurs outside a recognized inline or floating drawing.");
  if (errors.length) return fail([...new Set(errors)]);

  const assets = [];
  for (let i = 0; i < imageRefs.length; i++) {
    const { id, block, placement } = imageRefs[i];
    const rel = relationships.get(id);
    if (!rel) {
      errors.push(`Image relationship ${id} is missing.`);
      continue;
    }
    if (rel.TargetMode === "External") {
      errors.push(`Image relationship ${id} points outside the DOCX package.`);
      continue;
    }
    if (!/\/image$/i.test(rel.Type)) {
      errors.push(`Relationship ${id} is not an image relationship.`);
      continue;
    }
    const target = posix.normalize(posix.join("word", rel.Target.replace(/^\//, "")));
    if (!target.startsWith("word/media/") || target.includes("/../")) {
      errors.push(`Image relationship ${id} resolves outside word/media/.`);
      continue;
    }
    const media = zip.file(target);
    if (!media) {
      errors.push(`Image media part is missing: ${target}.`);
      continue;
    }
    const bytes = await media.async("nodebuffer");
    const extension = posix.extname(target).slice(1).toLowerCase();
    const contentType = overrides.get(target) ?? defaults.get(extension);
    if (!contentType || !/^image\//i.test(contentType)) {
      errors.push(`Missing or non-image content type for ${target}.`);
      continue;
    }
    const docPr = block.match(/<wp:docPr\b[^>]*\/?\s*>/);
    const altText = docPr ? (attr(docPr[0], "descr") ?? attr(docPr[0], "title") ?? "") : "";
    assets.push({
      sourceOrder: i + 1,
      relationshipId: id,
      placement,
      sourcePath: target,
      outputPath: `/assets/docx-${sha256(bytes).slice(0, 16)}.${extension}`,
      altText,
      contentType,
      byteLength: bytes.length,
      sha256: sha256(bytes),
      bytes
    });
  }

  return errors.length ? fail([...new Set(errors)]) : { ok: true, errors: [], assets };
}
