import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {inspectDocxSourceMap} from './inspect-docx-source-map.mjs';
import {inspectDocxAssets} from './inspect-docx-assets.mjs';
import {inspectDocxImagePlacement} from './inspect-docx-image-placement.mjs';
import {inspectDocxRichContent} from './inspect-docx-rich-content.mjs';
import {extractDocx} from './extract-docx.mjs';
import {countXmlTag} from './pilot-xml-diagnostics.mjs';

const sourcePath = 'temp/多重時空是什麽 - 繁體 - Copy.docx';
const outputPath = 'pilot-artifacts/pilot-audit.json';
const buffer = await readFile(sourcePath);
const sha256 = createHash('sha256').update(buffer).digest('hex');
const stages = {};
const diagnostic = {unsupportedTextConstructs:[], drawingKinds:{}, explicitColors:[], lineBreaks:[], floatingDrawings:[], runPropertyInventory:{counts:{},samples:{}}, paragraphPropertyInventory:{counts:{},samples:{}},styleResolutionInventory:{references:[],definitions:[],docDefaults:{}}};
try {
  const zip = await JSZip.loadAsync(buffer,{checkCRC32:true});
  const xml = await zip.file('word/document.xml').async('string');
  const textNames = ['txbxContent','altChunk','sdt','ins','del','fldSimple','instrText','hyperlink','tab','br','cr','sym','noBreakHyphen','softHyphen'];
  for (const name of textNames) {
    const count = countXmlTag(xml, 'w:' + name);
    if (count) diagnostic.unsupportedTextConstructs.push({name,count});
  }
  const alternate = [...xml.matchAll(/<mc:AlternateContent\b/g)].length;
  if (alternate) diagnostic.unsupportedTextConstructs.push({name:'mc:AlternateContent',count:alternate});
  for (const name of ['anchor','inline']) diagnostic.drawingKinds[name] = countXmlTag(xml, 'wp:' + name);
  const colors = new Map();
  for (const tag of xml.matchAll(/<w:color\b[^>]*>/g)) {
    const value = /\bw:val=["']([^"']+)["']/.exec(tag[0])?.[1] ?? '(no val)';
    colors.set(value,(colors.get(value) ?? 0)+1);
  }
  diagnostic.explicitColors = [...colors].map(([value,count])=>({value,count}));
  const stylesPart = zip.file('word/styles.xml');
  if (stylesPart) {
    const stylesXml = await stylesPart.async('string');
    const refs = new Map();
    for (const match of xml.matchAll(/<w:(pStyle|rStyle)\b[^>]*\bw:val=["']([^"']+)["'][^>]*\/?\s*>/g)) {
      const key = match[1] + ':' + match[2];
      refs.set(key, (refs.get(key) ?? 0) + 1);
    }
    diagnostic.styleResolutionInventory.references = [...refs].map(([key,count]) => {
      const [kind,id] = key.split(':');
      return {kind,id,count};
    });
    const styleTags = [...stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)];
    const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=["']([^"']*)["']/g)].map(m=>[m[1],m[2]]));
    const propNames = (body, tag) => {
      const content = new RegExp('<w:' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/w:' + tag + '>').exec(body)?.[1] ?? '';
      return [...content.matchAll(/<w:([A-Za-z][A-Za-z0-9]*)\b[^>]*\/?\s*>/g)].map(x=>x[1]);
    };
    const visitedStyles = new Set();
    const appendStyleChain = (id, referenceKind, depth=0) => {
      if (visitedStyles.has(id) || depth > 12) return;
      visitedStyles.add(id);
      const found = styleTags.find(m => attributes(m[1])['w:styleId'] === id);
      if (!found) {
        diagnostic.styleResolutionInventory.definitions.push({id,kind:referenceKind,missing:true});
        return;
      }
      const attrs = attributes(found[1]);
      const body = found[2];
      const name = /<w:name\b[^>]*\bw:val=["']([^"']+)["']/.exec(body)?.[1] ?? null;
      const basedOn = /<w:basedOn\b[^>]*\bw:val=["']([^"']+)["']/.exec(body)?.[1] ?? null;
      diagnostic.styleResolutionInventory.definitions.push({
        id:attrs['w:styleId'],type:attrs['w:type'],name,basedOn,
        runProperties:propNames(body,'rPr'),paragraphProperties:propNames(body,'pPr')
      });
      if (basedOn) appendStyleChain(basedOn, referenceKind, depth+1);
    };
    for (const ref of diagnostic.styleResolutionInventory.references.slice(0,30)) appendStyleChain(ref.id,ref.kind);
    const defaults = /<w:docDefaults\b[^>]*>([\s\S]*?)<\/w:docDefaults>/.exec(stylesXml)?.[1] ?? '';
    diagnostic.styleResolutionInventory.docDefaults = {
      runProperties:propNames(defaults,'rPrDefault'),
      paragraphProperties:propNames(defaults,'pPrDefault')
    };
  }
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)];
  const recordProperties = (inventory, tag, paragraphIndex, sample) => {
    inventory.counts[tag] = (inventory.counts[tag] ?? 0) + 1;
    if (!inventory.samples[tag]) inventory.samples[tag] = [];
    if (inventory.samples[tag].length < 4) inventory.samples[tag].push({paragraphIndex, sample:sample.slice(0,180)});
  };
  for (let i=0;i<paragraphs.length;i++) {
    const raw = paragraphs[i][0];
    for (const pPr of raw.matchAll(/<w:pPr(?=[\s>])[^>]*>([\s\S]*?)<\/w:pPr>/g)) {
      for (const tag of pPr[1].matchAll(/<w:([A-Za-z][A-Za-z0-9]*)\b[^>]*\/?\s*>/g)) {
        if (!tag[0].startsWith('</')) recordProperties(diagnostic.paragraphPropertyInventory,tag[1],i,tag[0]);
      }
    }
    for (const run of raw.matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const rPr = /<w:rPr(?=[\s>])[^>]*>([\s\S]*?)<\/w:rPr>/.exec(run[1]);
      if (rPr) for (const tag of rPr[1].matchAll(/<w:([A-Za-z][A-Za-z0-9]*)\b[^>]*\/?\s*>/g)) {
        if (!tag[0].startsWith('</')) recordProperties(diagnostic.runPropertyInventory,tag[1],i,tag[0]);
      }
    }
    const breaks = [...raw.matchAll(/<w:br(?=[\s/>])[^>]*\/?\s*>/g)];
    for (const br of breaks) diagnostic.lineBreaks.push({paragraphIndex:i, tag:br[0], textBefore:raw.slice(0,br.index).replace(/<[^>]*>/g,'').slice(-60), textAfter:raw.slice(br.index+br[0].length).replace(/<[^>]*>/g,'').slice(0,60)});
    for (const anchor of raw.matchAll(/<wp:anchor(?=[\s>])[^>]*>[\s\S]*?<\/wp:anchor>/g)) {
      const body=anchor[0], firstTag=/^<wp:anchor[^>]*>/.exec(body)?.[0] ?? '';
      const position=[...body.matchAll(/<wp:position(?:H|V)\b[^>]*>[\s\S]*?<\/wp:position(?:H|V)>/g)].map(x=>x[0]);
      const embeds=[...body.matchAll(/\br:embed=["']([^"']+)["']/g)].map(x=>x[1]);
      const docPr=/<wp:docPr\b[^>]*\/>/.exec(body)?.[0] ?? null;
      diagnostic.floatingDrawings.push({paragraphIndex:i, anchorAttributes:firstTag, position, relationshipIds:embeds, docPr, hasWrap:/<wp:wrap\w+\b/.test(body)});
    }
  }

} catch(error) {diagnostic.error = 'Cannot inspect pilot XML: ' + error.message;}

for (const [name, inspect] of [
  ['sourceMap', inspectDocxSourceMap],
  ['assets', inspectDocxAssets],
  ['imagePlacement', inspectDocxImagePlacement],
  ['richContent', inspectDocxRichContent],
  ['conversion', extractDocx]
]) {
  try {
    const result = await inspect(buffer);
    stages[name] = {ok: result.ok, errors: result.errors ?? [],
      ...(Array.isArray(result.paragraphs) ? {paragraphCount: result.paragraphs.length} : {}),
      ...(Array.isArray(result.assets) ? {assetCount: result.assets.length} : {}),
      ...(Array.isArray(result.images) ? {imageCount: result.images.length, floatingImageCount:result.images.filter(image=>image.placement?.kind==='floating').length, floatingVisualReviewCount:result.images.filter(image=>image.placement?.kind==='floating' && image.placement.requiresVisualReview===true).length} : {}),
      ...(Array.isArray(result.runs) ? {runCount: result.runs.length} : {})
    };
  } catch (error) {
    stages[name] = {ok:false, errors:['Inspector exception: ' + error.message]};
  }
}
const report = {sourcePath, byteLength:buffer.length, sha256, diagnostic, stages,
  pilotApproved:false,
  note:'Diagnostic only. No language segmentation or reviewed page set has been approved.'};
await mkdir('pilot-artifacts',{recursive:true});
await writeFile(outputPath, JSON.stringify(report,null,2)+'\n');

// Produce a review aid for source-image inspection, never a generated article.
// Inline image bytes are embedded only in this CI artifact so reviewers can see
// the source images and surrounding source paragraphs without changing the DOCX.
const visualReviewPath = 'pilot-artifacts/pilot-visual-review.html';
try {
  const [sourceForReview, assetsForReview, placementsForReview] = await Promise.all([
    inspectDocxSourceMap(buffer), inspectDocxAssets(buffer), inspectDocxImagePlacement(buffer)
  ]);
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  if (!sourceForReview.ok || !assetsForReview.ok || !placementsForReview.ok) {
    await writeFile(visualReviewPath, '<!doctype html><meta charset="utf-8"><title>Pilot visual review blocked</title><h1>Visual review artifact blocked</h1><pre>' + esc(JSON.stringify({source:sourceForReview.errors,assets:assetsForReview.errors,placements:placementsForReview.errors},null,2)) + '</pre>');
  } else {
    const assetById = new Map(assetsForReview.assets.map(asset => [asset.relationshipId, asset]));
    const paragraphIndexHtml = sourceForReview.paragraphs.map(p => '<p class="source-paragraph"><strong>Paragraph ' + (p.index+1) + ':</strong> ' + esc(p.text) + (p.breaks.length ? ' <em>[explicit line break: ' + p.breaks.length + ']</em>' : '') + '</p>').join(' ');
    const sections = placementsForReview.images.map((item,index) => {
      const asset = assetById.get(item.relationshipId);
      const paragraphIndex = item.paragraphIndex;
      const paragraphs = sourceForReview.paragraphs;
      const context = [paragraphs[paragraphIndex-1],paragraphs[paragraphIndex],paragraphs[paragraphIndex+1]].filter(Boolean);
      const image = asset ? '<img alt="' + esc(asset.altText || ('Source image ' + (index+1))) + '" src="data:' + esc(asset.contentType) + ';base64,' + asset.bytes.toString('base64') + '">' : '<p>Embedded source image unavailable.</p>';
      return '<section><h2>Image ' + (index+1) + ' — paragraph ' + (paragraphIndex+1) + '</h2><p><strong>Placement:</strong> ' + esc(item.placement.kind) + (item.placement.requiresVisualReview ? ' — manual visual review required' : '') + '</p><p><strong>Relationship:</strong> ' + esc(item.relationshipId) + ' · <strong>SHA-256:</strong> ' + esc(item.sha256) + '</p>' + image + '<h3>Source paragraph context</h3>' + context.map((p,i)=>'<p class="context"><strong>' + (p.index===paragraphIndex?'Image paragraph':p.index<paragraphIndex?'Previous paragraph':'Next paragraph') + ':</strong> ' + esc(p.text) + '</p>').join('') + '<details><summary>Raw placement metadata</summary><pre>' + esc(JSON.stringify(item.placement,null,2)) + '</pre></details></section>';
    }).join('\n');
    await writeFile(visualReviewPath, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DOCX pilot source image review</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#222}section{border-top:1px solid #aaa;padding:1.5rem 0}img{display:block;max-width:100%;max-height:600px;object-fit:contain;margin:1rem auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}.context{padding:.6rem;border-left:3px solid #bbb}.warning{padding:1rem;background:#fff2cc}</style><h1>DOCX pilot — source image review</h1><p class="warning">This is a source inspection aid, not a converted page preview. Floating image metadata cannot prove visual fidelity. Compare the floating image against its original position and wrapping in Word before approving the page generator.</p>' + sections + '<details><summary>All source paragraphs (' + sourceForReview.paragraphs.length + ')</summary>' + paragraphIndexHtml + '</details></html>');
  }
} catch(error) {
  await writeFile(visualReviewPath, '<!doctype html><meta charset="utf-8"><title>Pilot visual review unavailable</title><h1>Visual review unavailable</h1><pre>' + String(error?.message ?? error).replace(/[&<>]/g,'') + '</pre>');
}
console.log(JSON.stringify(report,null,2));
