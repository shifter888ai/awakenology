import JSZip from 'jszip';
import { inspectDocxSourceMap } from './inspect-docx-source-map.mjs';
import { inspectDocxImagePlacement } from './inspect-docx-image-placement.mjs';

// Conservative OOXML extractor. Anything not mapped with certainty blocks approval.
export async function inspectDocxRichContent(buffer) {
  const fail = errors => ({ ok: false, errors, runs: [], images: [] });
  const source = await inspectDocxSourceMap(buffer);
  if (!source.ok) return fail(source.errors);
  let xml;
  try {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    xml = await zip.file('word/document.xml').async('string');
  } catch { return fail(['Cannot read original OOXML.']); }

  const errors = [], runs = [];
  const placement = await inspectDocxImagePlacement(buffer);
  if (!placement.ok) errors.push(...placement.errors);
  if (/<w:(?:pStyle|rStyle|basedOn|hyperlink|object|pict|fldChar|highlight|shd)\b/.test(xml)) {
    errors.push('Inherited styles, hyperlinks, or advanced formatting require independent resolution.');
  }
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s>])[^>]*>([\s\S]*?)<\/w:p>/g)];
  for (let p = 0; p < paragraphs.length; p++) {
    const raw = paragraphs[p][1];
    for (const match of raw.matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const body = match[1];
      if (/<w:drawing\b/.test(body) && !/<w:t(?=[\s>])/.test(body)) continue;
      const properties = /<w:rPr(?=[\s>])[^>]*>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1] ?? '';
      const unknown = properties.replace(/<w:(?:b|i|u|color)(?:\s[^>]*?)?\s*\/\s*>/g, '').trim();
      if (unknown) errors.push('Unresolved run property in paragraph ' + (p + 1) + '.');
      const flag = key => new RegExp('<w:' + key + '(?:\\s[^>]*?)?\\s*/>').test(properties);
      const attr = (key, name) => new RegExp('<w:' + key + '\\b[^>]*\\bw:' + name + '=["\\x27]([^"\\x27]+)["\\x27][^>]*/>').exec(properties)?.[1] ?? null;
      const color = attr('color', 'val');
      if (color && !/^[0-9a-fA-F]{6}$/.test(color)) errors.push('Unresolved Word color in paragraph ' + (p + 1) + '.');
      const texts = [...body.matchAll(/<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g)];
      if (texts.length !== 1) { errors.push('Ambiguous run/text mapping in paragraph ' + (p + 1) + '.'); continue; }
      const decode = s => s.replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[x]);
      runs.push({ text: decode(texts[0][1]), bold: flag('b'), italic: flag('i'), underline: flag('u'), color: color ? '#' + color.toLowerCase() : null, href: null });
    }
  }
  if (runs.map(r => r.text).join('') !== source.paragraphs.map(p => p.text).join('')) errors.push('Rich runs do not reproduce exact source-map text.');
  if (!runs.length) errors.push('No rich text runs extracted.');
  const images = placement.ok ? placement.images.map(({assetPath, paragraphIndex, order, alt}) => ({assetPath, paragraphIndex, order, alt})) : [];
  return errors.length ? fail([...new Set(errors)]) : {ok:true, errors:[], runs, images};
}
