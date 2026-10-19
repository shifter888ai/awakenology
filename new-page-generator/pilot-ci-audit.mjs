import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {inspectDocxSourceMap} from './inspect-docx-source-map.mjs';
import {inspectDocxAssets} from './inspect-docx-assets.mjs';
import {inspectDocxImagePlacement} from './inspect-docx-image-placement.mjs';
import {inspectDocxRichContent} from './inspect-docx-rich-content.mjs';
import {extractDocx} from './extract-docx.mjs';
import {countXmlTag} from './pilot-xml-diagnostics.mjs';
import {resolveDocxNumbering} from './resolve-docx-numbering.mjs';
import {renderStaticShell} from './static-shell.mjs';

const sourcePath = 'temp/多重時空是什麽 - 繁體 - Copy.docx';
const outputPath = 'pilot-artifacts/pilot-audit.json';
const buffer = await readFile(sourcePath);
const conversionCandidate = await extractDocx(buffer);
const sha256 = createHash('sha256').update(buffer).digest('hex');
const stages = {};
const diagnostic = {unsupportedTextConstructs:[], drawingKinds:{}, explicitColors:[], lineBreaks:[], floatingDrawings:[], runPropertyInventory:{counts:{},samples:{}}, paragraphPropertyInventory:{counts:{},samples:{}},fontFamilyVariants:[],fontResolutionSamples:[],paragraphSpacingVariants:[],paragraphIndentationVariants:[],numberingInventory:null,styleResolutionInventory:{references:[],definitions:[],docDefaults:{}}};
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
    const defaultsRunXml=/<w:rPrDefault\\b[^>]*>([\\s\\S]*?)<\\/w:rPrDefault>/.exec(stylesXml)?.[1]??'';
    diagnostic.styleResolutionInventory.fontTags={
      docDefaults:[...defaultsRunXml.matchAll(/<w:rFonts\\b[^>]*\\/?\\s*>/g)].map(x=>x[0]),
      styles:[...stylesXml.matchAll(/<w:style\\b([^>]*)>([\\s\\S]*?)<\\/w:style>/g)].map(m=>{
        const id=/w:styleId=["']([^"']+)["']/.exec(m[1])?.[1]??null;
        const body=m[2], runBody=body.replace(/<w:pPr\\b[^>]*>[\\s\\S]*?<\\/w:pPr>/g,'');
        return {id,run:[...runBody.matchAll(/<w:rFonts\\b[^>]*\\/?\\s*>/g)].map(x=>x[0]),paragraphMark:[...body.matchAll(/<w:pPr\\b[^>]*>[\\s\\S]*?<w:rFonts\\b[^>]*\\/?\\s*>/g)].map(x=>x[0].match(/<w:rFonts\\b[^>]*\\/?\\s*>/)?.[0]??null).filter(Boolean)};
      })
    };
    const themePart=zip.file('word/theme/theme1.xml');
    if(themePart){
      const themeXml=await themePart.async('string');
      const scheme=(name)=>{const section=new RegExp('<a:'+name+'Font\\\\b[^>]*>([\\\\s\\\\S]*?)<\\\\/a:'+name+'Font>').exec(themeXml)?.[1]??'';return {latin:/<a:latin\\b[^>]*\\btypeface=["']([^"']*)["']/.exec(section)?.[1]??null,eastAsia:/<a:ea\\b[^>]*\\btypeface=["']([^"']*)["']/.exec(section)?.[1]??null,complexScript:/<a:cs\\b[^>]*\\btypeface=["']([^"']*)["']/.exec(section)?.[1]??null,scripts:[...section.matchAll(/<a:font\\b[^>]*\\bscript=["']([^"']+)["'][^>]*\\btypeface=["']([^"']*)["'][^>]*\\/?\\s*>/g)].map(x=>({script:x[1],typeface:x[2]}))};};
      diagnostic.themeFontScheme={major:scheme('major'),minor:scheme('minor')};
    }
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
  const fontFamilyVariants = new Map();
  for (const match of xml.matchAll(/<w:rFonts\b[^>]*\/?\s*>/g)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:.-]+)=["']([^"']*)["']/g)].map(item=>[item[1],item[2]]));
    const tuple = {ascii:attrs['w:ascii']??null,hAnsi:attrs['w:hAnsi']??null,eastAsia:attrs['w:eastAsia']??null,cs:attrs['w:cs']??null};
    const key=JSON.stringify(tuple);
    const entry=fontFamilyVariants.get(key)??{families:tuple,count:0,samples:[]};
    entry.count++;
    if(entry.samples.length<5) entry.samples.push({xmlOffset:match.index,tag:match[0]});
    fontFamilyVariants.set(key,entry);
  }
  diagnostic.fontFamilyVariants=[...fontFamilyVariants.values()];
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)];
  const numberingPart = zip.file('word/numbering.xml');
  if (numberingPart) {
    const numberingXml = await numberingPart.async('string');
    const abstract = new Map();
    for (const match of numberingXml.matchAll(/<w:abstractNum\b([^>]*)>([\s\S]*?)<\/w:abstractNum>/g)) {
      const id = /w:abstractNumId=["']([^"']+)["']/.exec(match[1])?.[1] ?? null;
      const levels = [...match[2].matchAll(/<w:lvl\b([^>]*)>([\s\S]*?)<\/w:lvl>/g)].map(level => ({
        ilvl: /w:ilvl=["']([^"']+)["']/.exec(level[1])?.[1] ?? null,
        numFmt: /<w:numFmt\b[^>]*\bw:val=["']([^"']+)["']/.exec(level[2])?.[1] ?? null,
        lvlText: /<w:lvlText\b[^>]*\bw:val=["']([^"']*)["']/.exec(level[2])?.[1] ?? null,
        start: /<w:start\b[^>]*\bw:val=["']([^"']+)["']/.exec(level[2])?.[1] ?? null
      }));
      abstract.set(id, levels);
    }
    const nums = new Map([...numberingXml.matchAll(/<w:num\b([^>]*)>([\s\S]*?)<\/w:num>/g)].map(match => [
      /w:numId=["']([^"']+)["']/.exec(match[1])?.[1] ?? null,
      /<w:abstractNumId\b[^>]*\bw:val=["']([^"']+)["']/.exec(match[2])?.[1] ?? null
    ]));
    const refs = [];
    paragraphs.forEach((match,index) => {
      const numPr = /<w:numPr\b[^>]*>([\s\S]*?)<\/w:numPr>/.exec(match[0])?.[1];
      if (!numPr) return;
      const numId = /<w:numId\b[^>]*\bw:val=["']([^"']+)["']/.exec(numPr)?.[1] ?? null;
      const ilvl = /<w:ilvl\b[^>]*\bw:val=["']([^"']+)["']/.exec(numPr)?.[1] ?? '0';
      const abstractNumId = nums.get(numId) ?? null;
      const level = (abstract.get(abstractNumId) ?? []).find(item => item.ilvl === ilvl) ?? null;
      const resolved = resolveDocxNumbering({numberingXml,paragraphXml:match[0]});
      refs.push({paragraphIndex:index,numId,ilvl,abstractNumId,level,resolved:resolved.numbering,resolutionErrors:resolved.errors});
    });
    diagnostic.numberingInventory = {definedNumIds:[...nums.entries()].map(([numId,abstractNumId])=>({numId,abstractNumId,levels:abstract.get(abstractNumId)??[]})),paragraphReferences:refs};
  } else {
    const refs=[];
    paragraphs.forEach((match,index)=>{
      const numPr=/<w:numPr\b[^>]*>([\s\S]*?)<\/w:numPr>/.exec(match[0])?.[1];
      if(!numPr) return;
      refs.push({paragraphIndex:index,numId:/<w:numId\b[^>]*\bw:val=["']([^"']+)["']/.exec(numPr)?.[1]??null,ilvl:/<w:ilvl\b[^>]*\bw:val=["']([^"']+)["']/.exec(numPr)?.[1]??'0',raw:numPr});
    });
    diagnostic.numberingInventory = {definedNumIds:[],paragraphReferences:refs,warning:'word/numbering.xml is missing'};
  }
  const recordProperties = (inventory, tag, paragraphIndex, sample) => {
    inventory.counts[tag] = (inventory.counts[tag] ?? 0) + 1;
    if (!inventory.samples[tag]) inventory.samples[tag] = [];
    if (inventory.samples[tag].length < 4) inventory.samples[tag].push({paragraphIndex, sample:sample.slice(0,180)});
  };
  const paragraphSpacingVariants=new Map(), paragraphIndentationVariants=new Map();
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
    const paragraphStyleId=/<w:pStyle\b[^>]*\bw:val=["']([^"']+)["']/.exec(raw)?.[1]??null;
    const markFont=/<w:pPr\b[^>]*>[\s\S]*?<w:rPr\b[^>]*>[\s\S]*?<w:rFonts\b[^>]*\/?\s*>[\s\S]*?<\/w:rPr>[\s\S]*?<\/w:pPr>/.exec(raw)?.[0]?.match(/<w:rFonts\b[^>]*\/?\s*>/)?.[0]??null;
    const runFontDetails=[...raw.matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)].map(run=>{
      const body=run[1], rPr=/<w:rPr(?=[\s>])[^>]*>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1]??'';
      const texts=[...body.matchAll(/<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g)].map(x=>x[1]).join('');
      return {text:texts.slice(0,100),fontTag:/<w:rFonts\b[^>]*\/?\s*>/.exec(rPr)?.[0]??null,style:/<w:rStyle\b[^>]*\bw:val=["']([^"']+)["']/.exec(rPr)?.[1]??null};
    }).filter(run=>run.text.trim());
    if(runFontDetails.some(run=>!run.fontTag||!/(?:w:ascii|w:hAnsi|w:eastAsia|w:cs)=/.test(run.fontTag))) diagnostic.fontResolutionSamples.push({paragraphIndex:i,paragraphStyleId,paragraphMarkFont:markFont,runs:runFontDetails});
    for(const match of raw.matchAll(/<w:spacing\b[^>]*\/?\s*>/g)){
      const tag=match[0], entry=paragraphSpacingVariants.get(tag)??{tag,count:0,paragraphs:[]};
      entry.count++; if(entry.paragraphs.length<10) entry.paragraphs.push(i); paragraphSpacingVariants.set(tag,entry);
    }
    for(const match of raw.matchAll(/<w:ind\b[^>]*\/?\s*>/g)){
      const tag=match[0], entry=paragraphIndentationVariants.get(tag)??{tag,count:0,paragraphs:[]};
      entry.count++; if(entry.paragraphs.length<10) entry.paragraphs.push(i); paragraphIndentationVariants.set(tag,entry);
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
  diagnostic.paragraphSpacingVariants=[...paragraphSpacingVariants.values()];
  diagnostic.paragraphIndentationVariants=[...paragraphIndentationVariants.values()];

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
      ...(Array.isArray(result.runs) ? {runCount: result.runs.length} : {}),
      ...(Array.isArray(result.paragraphNumbering) ? {paragraphNumbering: result.paragraphNumbering} : {}),
      ...(Array.isArray(result.paragraphMarkFormatting) ? {paragraphMarkFormatting: result.paragraphMarkFormatting} : {})
    };
  } catch (error) {
    stages[name] = {ok:false, errors:['Inspector exception: ' + error.message]};
  }
}
const report = {sourcePath, byteLength:buffer.length, sha256, diagnostic, stages,
  conversionPreview:{publishable:false,previewAvailable:typeof conversionCandidate.previewHtml==='string',errors:conversionCandidate.errors},
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
    const imagesByParagraph = new Map();
    placementsForReview.images.forEach((item,index) => {
      const group = imagesByParagraph.get(item.paragraphIndex) ?? [];
      group.push({item,index});
      imagesByParagraph.set(item.paragraphIndex,group);
    });
    const sourceSequenceHtml = sourceForReview.paragraphs.map(p => {
      const images = (imagesByParagraph.get(p.index) ?? []).map(({item,index}) => {
        const asset = assetById.get(item.relationshipId);
        if (!asset) return '<p class="warning">Source image ' + (index+1) + ' unavailable</p>';
        return '<figure><img alt="' + esc(asset.altText || ('Source image ' + (index+1))) + '" src="data:' + esc(asset.contentType) + ';base64,' + asset.bytes.toString('base64') + '"><figcaption>Source image ' + (index+1) + ' · ' + esc(item.placement.kind) + ' placement · paragraph ' + (p.index+1) + '</figcaption></figure>';
      }).join('');
      return '<section class="source-block"><small>Source paragraph ' + (p.index+1) + '</small><p>' + esc(p.text) + (p.breaks.length ? '<span class="warning"> [explicit line break × ' + p.breaks.length + ']</span>' : '') + '</p>' + images + '</section>';
    }).join('');
    const sections = placementsForReview.images.map((item,index) => {
      const asset = assetById.get(item.relationshipId);
      const paragraphIndex = item.paragraphIndex;
      const paragraphs = sourceForReview.paragraphs;
      const context = [paragraphs[paragraphIndex-1],paragraphs[paragraphIndex],paragraphs[paragraphIndex+1]].filter(Boolean);
      const image = asset ? '<img alt="' + esc(asset.altText || ('Source image ' + (index+1))) + '" src="data:' + esc(asset.contentType) + ';base64,' + asset.bytes.toString('base64') + '">' : '<p>Embedded source image unavailable.</p>';
      return '<section><h2>Image ' + (index+1) + ' — paragraph ' + (paragraphIndex+1) + '</h2><p><strong>Placement:</strong> ' + esc(item.placement.kind) + (item.placement.requiresVisualReview ? ' — manual visual review required' : '') + '</p><p><strong>Relationship:</strong> ' + esc(item.relationshipId) + ' · <strong>SHA-256:</strong> ' + esc(item.sha256) + '</p>' + image + '<h3>Source paragraph context</h3>' + context.map((p,i)=>'<p class="context"><strong>' + (p.index===paragraphIndex?'Image paragraph':p.index<paragraphIndex?'Previous paragraph':'Next paragraph') + ':</strong> ' + esc(p.text) + '</p>').join('') + '<details><summary>Raw placement metadata</summary><pre>' + esc(JSON.stringify(item.placement,null,2)) + '</pre></details></section>';
    }).join('\n');
    await writeFile(visualReviewPath, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DOCX pilot source image review</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#222}section{border-top:1px solid #aaa;padding:1.5rem 0}img{display:block;max-width:100%;max-height:600px;object-fit:contain;margin:1rem auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}.context{padding:.6rem;border-left:3px solid #bbb}.warning{padding:1rem;background:#fff2cc}</style><h1>DOCX pilot — source image review</h1><p class="warning">This is a source inspection aid, not a converted page preview. Floating image metadata cannot prove visual fidelity. Compare the floating image against its original position and wrapping in Word before approving the page generator.</p>' + '<h2>Linear source sequence (text and images)</h2><p>This sequence preserves source paragraph order and text but does not reproduce Word typography, page layout, or floating-image wrapping. Do not treat it as approved output.</p>' + sourceSequenceHtml + '<h2>Image details</h2>' + sections + '<details><summary>All source paragraphs (' + sourceForReview.paragraphs.length + ')</summary>' + paragraphIndexHtml + '</details></html>');
  }
} catch(error) {
  await writeFile(visualReviewPath, '<!doctype html><meta charset="utf-8"><title>Pilot visual review unavailable</title><h1>Visual review unavailable</h1><pre>' + String(error?.message ?? error).replace(/[&<>]/g,'') + '</pre>');
}
// Render a separate, visibly unapproved HTML conversion candidate when source fidelity
// checks permit it. Floating Word images are intentionally inline in this candidate
// until their original wrapping and position are reviewed.
const convertedPreviewPath = 'pilot-artifacts/pilot-converted-preview.html';
try {
  let candidate = conversionCandidate.previewHtml ?? '';
  const imageCheck = await inspectDocxAssets(buffer);
  if (conversionCandidate.previewHtml && imageCheck.ok) {
    for (const asset of imageCheck.assets) {
      const dataUrl = 'data:' + asset.contentType + ';base64,' + asset.bytes.toString('base64');
      candidate = candidate.split('src="' + asset.outputPath + '"').join('src="' + dataUrl + '"');
    }
  }
  const header = '<header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Awakenology home"><svg viewBox="0 0 100 100" role="img" aria-label="Circled A" style="width:34px;height:34px;transform:rotate(5deg)"><circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="7"/><path d="M27 72 L50 24 L73 72 M37 55 H63" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg><span>Awakenology</span></a><nav class="nav" aria-label="Site navigation"><a href="/English/">English</a><a href="/Japanese/">日本語</a><a href="/Chinese/">中文</a><a href="/ai-search/">Search / Ask</a></nav></div></header>';
  const footer = '<footer class="footer"><div class="footer-inner"><span class="footer-links"><a class="contact-icon" href="mailto:contact@awakenology.org" aria-label="Contact" title="Contact">✉</a><a class="reddit-icon" href="https://www.reddit.com/r/EscapeReincarnation/" aria-label="Reddit: Escape Reincarnation"><img src="/assets/reddit-one.svg" alt=""></a><a class="reddit-icon" href="https://www.reddit.com/r/EscapePrisonPlanet/" aria-label="Reddit: Escape Prison Planet"><img src="/assets/reddit-two.svg" alt=""></a><a class="reddit-icon" href="https://www.reddit.com/user/Lower-Lingonberry-40/" aria-label="Reddit profile"><img src="/assets/reddit-three.svg" alt=""></a><a class="disclaimer-icon" href="/Disclaimer/" aria-label="Disclaimer" title="Disclaimer">ⓘ</a></span><span>© 2017 Awakenology</span></div></footer>';
  const warning = '<aside class="preview-note" role="note"><strong>CONVERSION REVIEW ONLY — NOT APPROVED FOR PUBLICATION</strong><p>This candidate applies mapped source typography and paragraph layout. The original floating image is displayed inline here; its Word wrapping and position have not been certified. Do not publish this preview.</p></aside>';
  const body = conversionCandidate.previewHtml
    ? warning + candidate
    : '<aside class="preview-note"><strong>CONVERSION PREVIEW UNAVAILABLE — NOT APPROVED FOR PUBLICATION</strong><p>The source rich-content gate has not passed, so no converted HTML candidate was emitted.</p><pre>' + conversionCandidate.errors.map(error=>String(error).replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]))).join('\n') + '</pre></aside>';
  const preview = renderStaticShell({
    language:'zh-Hant',
    title:'DOCX Conversion Review — Not Approved',
    description:'Non-publishing source conversion review preview.',
    route:'/pilot-conversion-review/',
    alternates:{en:'/pilot-conversion-review-en/',ja:'/pilot-conversion-review-ja/','zh-Hant':'/pilot-conversion-review/'},
    approvedHeader:header,
    approvedFooter:footer,
    reviewedArticleHtml:body,
    integrityApproved:true
  });
  await writeFile(convertedPreviewPath,preview);
  console.log('Wrote ' + convertedPreviewPath + ' (review only; never publish).');
} catch(error) {
  await writeFile(convertedPreviewPath,'<!doctype html><meta charset="utf-8"><title>Conversion preview unavailable</title><h1>Conversion preview unavailable</h1><pre>'+String(error?.message??error).replace(/[&<>]/g,'')+'</pre>');
}
console.log(JSON.stringify(report,null,2));
