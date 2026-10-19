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
  const unknownRunProperties = new Map();
  const advancedTags = new Map();
  const placement = await inspectDocxImagePlacement(buffer);
  if (!placement.ok) errors.push(...placement.errors);
  for (const match of xml.matchAll(/<w:(pStyle|rStyle|basedOn|hyperlink|object|pict|fldChar|highlight|shd)\b/g)) {
    const name = match[1];
    advancedTags.set(name, (advancedTags.get(name) ?? 0) + 1);
  }
  for (const [name, count] of advancedTags) {
    errors.push('Unresolved OOXML feature w:' + name + ' (' + count + ' occurrence' + (count === 1 ? '' : 's') + ').');
  }
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s>])[^>]*>([\s\S]*?)<\/w:p>/g)];
  for (let p = 0; p < paragraphs.length; p++) {
    const raw = paragraphs[p][1];
    for (const match of raw.matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const body = match[1];
      if (/<w:drawing\b/.test(body) && !/<w:t(?=[\s>])/.test(body)) continue;
      const properties = /<w:rPr(?=[\s>])[^>]*>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1] ?? '';
      const unknown = properties.replace(/<w:(?:b|i|u|color)(?:\s[^>]*?)?\s*\/\s*>/g, '').trim();
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
      if (texts.length !== 1) { errors.push('Ambiguous run/text mapping in paragraph ' + (p + 1) + '.'); continue; }
      const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-fA-F]+|[0-9]+);/g, entity => {
        const named = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}; 
        if (entity in named) return named[entity];
        const code = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
      });
      runs.push({ text: decode(texts[0][1]), bold: flag('b'), italic: flag('i'), underline: flag('u'), color: color ? '#' + color.toLowerCase() : null, href: null });
    }
  }
  for (const [name, paragraphSet] of unknownRunProperties) {
    const locations = [...paragraphSet].sort((a,b) => a-b);
    const preview = locations.slice(0, 12).join(', ') + (locations.length > 12 ? ', …' : '');
    errors.push('Unresolved run property w:' + name + ' in ' + locations.length + ' paragraph(s): ' + preview + '.');
  }
  if (runs.map(r => r.text).join('') !== source.paragraphs.map(p => p.text).join('')) errors.push('Rich runs do not reproduce exact source-map text.');
  if (!runs.length) errors.push('No rich text runs extracted.');
  const images = placement.ok ? placement.images.map(({assetPath, paragraphIndex, order, alt}) => ({assetPath, paragraphIndex, order, alt})) : [];
  return errors.length ? fail([...new Set(errors)]) : {ok:true, errors:[], runs, images};
}
