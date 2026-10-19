import JSZip from 'jszip';
import { inspectDocxSourceMap } from './inspect-docx-source-map.mjs';
import { inspectDocxImagePlacement } from './inspect-docx-image-placement.mjs';
import { resolveDocxRunFormatting } from './resolve-docx-styles.mjs';
import { resolveDocxParagraphLayout } from './resolve-docx-paragraph-layout.mjs';
import { resolveDocxNumbering } from './resolve-docx-numbering.mjs';
import { splitWordScriptSegments } from './word-script-segments.mjs';

// Conservative OOXML extractor. Anything not mapped with certainty blocks approval.
export async function inspectDocxRichContent(buffer) {
  const fail = errors => ({ ok: false, errors, runs: [], images: [], lineBreaks: [], paragraphLayouts: [], paragraphNumbering: [], paragraphCount: 0 });
  const source = await inspectDocxSourceMap(buffer);
  if (!source.ok) return fail(source.errors);
  let xml, stylesXml, numberingXml, hasSectionBreak = false;
  try {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    const documentPart = zip.file('word/document.xml');
    const stylesPart = zip.file('word/styles.xml');
    const numberingPart = zip.file('word/numbering.xml');
    if (!documentPart) return fail(['Original document OOXML part is missing.']);
    xml = await documentPart.async('string');
    hasSectionBreak = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].some(paragraph => /<w:pPr\b[^>]*>[\s\S]*?<w:sectPr\b/.test(paragraph[0]));
    stylesXml = stylesPart ? await stylesPart.async('string') : '<w:styles></w:styles>';
    numberingXml = numberingPart ? await numberingPart.async('string') : '<w:numbering></w:numbering>';
  } catch { return fail(['Cannot read original OOXML.']); }

  const errors = [], runs = [], paragraphLayouts = [], paragraphNumbering = [];
  if (hasSectionBreak) errors.push('Section breaks inside document content require manual resolution.');
  const unknownRunProperties = new Map();
  const advancedTags = new Map();
  for (const match of xml.matchAll(/<w:numPr\b[^>]*>([\s\S]*?)<\/w:numPr>/g)) {
    const numId=/<w:numId\b[^>]*\bw:val=["']([^"']+)["']/.exec(match[1])?.[1]??null;
    if (numId !== '0') errors.push('Active or unresolved Word paragraph numbering requires independent list mapping.');
  }
  const placement = await inspectDocxImagePlacement(buffer);
  if (!placement.ok) errors.push(...placement.errors);
  for (const match of xml.matchAll(/<w:(hyperlink|object|pict|fldChar|highlight|shd|keepNext|keepLines|pageBreakBefore|outlineLvl|contextualSpacing|bidi|textDirection|mirrorIndents|snapToGrid|adjustRightInd|autoSpaceDE|autoSpaceDN|tbl|vertAlign|position|vanish|specVanish|smallCaps|emboss|imprint|shadow|outline|effect|fitText|rtl|cs)\b/g)) {
    const name = match[1];
    advancedTags.set(name, (advancedTags.get(name) ?? 0) + 1);
  }
  for (const [name, count] of advancedTags) {
    errors.push('Unresolved OOXML feature w:' + name + ' (' + count + ' occurrence' + (count === 1 ? '' : 's') + ').');
  }
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s>])[^>]*>([\s\S]*?)<\/w:p>/g)];
  for (let p = 0; p < paragraphs.length; p++) {
    const raw = paragraphs[p][1];
    const layout = resolveDocxParagraphLayout({stylesXml, paragraphXml: paragraphs[p][0]});
    if (!layout.ok) errors.push(...layout.errors.map(error => 'Paragraph ' + (p + 1) + ' layout: ' + error));
    paragraphLayouts.push({paragraphIndex:p, ...(layout.layout ?? {unsupported:true})});
    const numbered = resolveDocxNumbering({numberingXml,paragraphXml:paragraphs[p][0]});
    if (!numbered.ok) errors.push(...numbered.errors.map(error => 'Paragraph '+(p+1)+' numbering: '+error));
    if (numbered.numbering) { paragraphNumbering.push({paragraphIndex:p,...numbered.numbering}); errors.push('Resolved Word list numbering at paragraph '+(p+1)+' still requires verified HTML list rendering.'); }
    for (const match of raw.matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const body = match[1];
      if (/<w:drawing\b/.test(body) && !/<w:t(?=[\s>])/.test(body)) continue;
      const properties = /<w:rPr(?=[\s>])[^>]*>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1] ?? '';
      const unknown = properties.replace(/<w:(?:b|i|u|color|sz|rStyle|rFonts|lang|szCs|bCs|iCs|caps|spacing)(?:\s[^>]*?)?\s*\/\s*>/g, '').trim();
      if (unknown) {
        for (const property of unknown.matchAll(/<w:([A-Za-z][A-Za-z0-9]*)\b/g)) {
          const name = property[1];
          if (!unknownRunProperties.has(name)) unknownRunProperties.set(name, new Set());
          unknownRunProperties.get(name).add(p + 1);
        }
      }
      const flag = key => {
        const tag = new RegExp('<w:' + key + '(?:\\s[^>]*?)?\\s*/>').exec(properties)?.[0];
        if (!tag) return false;
        const value = /\bw:val=["\x27]([^"\x27]+)["\x27]/.exec(tag)?.[1]?.toLowerCase();
        const allowed = key === 'u' ? ['single', '0', 'false', 'off', 'none'] : ['1', 'true', 'on', '0', 'false', 'off', 'none'];
        if (value && !allowed.includes(value)) {
          errors.push('Unsupported Word ' + key + ' value in paragraph ' + (p + 1) + '.');
          return false;
        }
        return !value || !['0', 'false', 'off', 'none'].includes(value);
      };
      const attr = (key, name) => new RegExp('<w:' + key + '\\b[^>]*\\bw:' + name + '=["\\x27]([^"\\x27]+)["\\x27][^>]*/>').exec(properties)?.[1] ?? null;
      const color = attr('color', 'val');
      if (color && !/^[0-9a-fA-F]{6}$/.test(color)) errors.push('Unresolved Word color in paragraph ' + (p + 1) + '.');
      if (/<w:color\b[^>]*\bw:theme(?:Color|Tint|Shade)=/.test(properties)) errors.push('Theme-based Word color requires independent resolution in paragraph ' + (p + 1) + '.');
      const texts = [...body.matchAll(/<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g)];
      const breakCount = [...body.matchAll(/<w:br(?=[\s/>])[^>]*\/?\s*>/g)].length;
      if (texts.length !== 1 && (!breakCount || breakCount < texts.length - 1)) {
        errors.push('Ambiguous run/text mapping in paragraph ' + (p + 1) + '.'); continue;
      }
      const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-fA-F]+|[0-9]+);/g, entity => {
        const named = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}; 
        if (entity in named) return named[entity];
        const code = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
      });
      const resolved = resolveDocxRunFormatting({stylesXml,paragraphXml:paragraphs[p][0],runXml:match[0]});
      if (!resolved.ok) errors.push(...resolved.errors.map(error => error.startsWith('Unsupported inherited Word formatting:') ? 'Paragraph ' + (p + 1) + ': ' + error : error));
      const formatting = resolved.formatting;
      for (const text of texts) {
      const baseRun = { paragraphIndex:p, text:decode(text[1]), bold:formatting?.b ?? flag('b'), italic:formatting?.i ?? flag('i'), underline:formatting?.u ?? flag('u'), color:formatting?.color ?? (color ? '#'+color.toLowerCase() : null), fontSizePt:formatting?.fontSizePt ?? null, href:null, fontFamily:formatting?.fontFamily ?? null, language:formatting?.language ?? null, fontSizeCsPt:formatting?.fontSizeCsPt ?? formatting?.fontSizePt ?? null, allCaps:formatting?.caps ?? false, letterSpacingPt:formatting?.letterSpacingPt ?? null, fontKerning:formatting?.fontKerning ?? null, fontHint:formatting?.fontHint ?? null };
      if (formatting?.bCs !== undefined) baseRun.boldCs = formatting.bCs;
      if (formatting?.iCs !== undefined) baseRun.italicCs = formatting.iCs;
      for (const segment of splitWordScriptSegments(baseRun.text,baseRun)) runs.push({...baseRun,text:segment.text,bold:segment.bold,italic:segment.italic,fontSizePt:segment.fontSizePt});
    }
    }
  }
  for (const [name, paragraphSet] of unknownRunProperties) {
    const locations = [...paragraphSet].sort((a,b) => a-b);
    const preview = locations.slice(0, 12).join(', ') + (locations.length > 12 ? ', …' : '');
    errors.push('Unresolved run property w:' + name + ' in ' + locations.length + ' paragraph(s): ' + preview + '.');
  }
  const lineBreaks = [];
  const imagePositions = new Map();
  for (const paragraph of source.paragraphs) {
    let textOffset = 0, markerOrder = 0;
    for (const item of paragraph.content ?? []) {
      if (item.type === 'lineBreak') {
        lineBreaks.push({paragraphIndex:paragraph.index,textOffset,breakType:item.breakType,markerOrder:markerOrder++});
      } else if (item.type === 'image') {
        imagePositions.set(item.relationshipId + ':' + item.sourceLocation.start,{textOffset,markerOrder:markerOrder++});
      } else if (item.type === 'text') textOffset += item.text.length;
    }
  }
  if (runs.map(r => r.text).join('') !== source.paragraphs.map(p => p.text).join('')) errors.push('Rich runs do not reproduce exact source-map text.');
  if (!runs.length) errors.push('No rich text runs extracted.');
  const images = placement.ok ? placement.images.map(({assetPath, paragraphIndex, order, alt, relationshipId, sourceLocation, placement: imagePlacement}) => {
    const position = imagePositions.get(relationshipId + ':' + sourceLocation.start);
    if (!position) errors.push('No ordered content position for image relationship ' + relationshipId + '.');
    return {assetPath, paragraphIndex, order, alt, textOffset:position?.textOffset ?? 0, markerOrder:position?.markerOrder ?? -1, placement:imagePlacement};
  }) : [];
  return errors.length ? {...fail([...new Set(errors)]), runs, images, lineBreaks, paragraphLayouts, paragraphNumbering, paragraphCount:source.paragraphs.length} : {ok:true, errors:[], runs, images, lineBreaks, paragraphLayouts, paragraphCount:source.paragraphs.length};
}
