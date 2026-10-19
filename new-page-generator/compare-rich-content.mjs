// Compare source and output rich-content inventories without normalizing authorial details.
// Expected runs: [{paragraphIndex, text, bold, italic, underline, color, href}] in document order.
// Expected images: [{assetPath, paragraphIndex, order, alt, textOffset, markerOrder}] in document order.
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const required = (o, keys, where) => {
  if (!o || typeof o !== 'object' || keys.some(k => !own(o, k))) {
    throw new Error('Incomplete rich-content inventory at ' + where);
  }
};
export function compareRichContent(source, output) {
  const issues = [];
  for (const [side, value] of [['source', source], ['output', output]]) {
    required(value, ['runs', 'images', 'lineBreaks', 'paragraphLayouts', 'paragraphCount'], side);
    if (!Array.isArray(value.runs) || !Array.isArray(value.images) || !Number.isInteger(value.paragraphCount) || value.paragraphCount < 0) throw new Error('Invalid inventory: ' + side);
    value.runs.forEach((r, i) => {
      const where = side + '.runs[' + i + ']';
      required(r, ['paragraphIndex', 'text', 'bold', 'italic', 'underline', 'color', 'fontSizePt', 'href'], where);
      if (!Number.isInteger(r.paragraphIndex) || r.paragraphIndex < 0 || typeof r.text !== 'string' || typeof r.bold !== 'boolean' ||
          typeof r.italic !== 'boolean' || typeof r.underline !== 'boolean' ||
          !(r.color === null || typeof r.color === 'string') || !(r.fontSizePt === null || (typeof r.fontSizePt === 'number' && Number.isFinite(r.fontSizePt) && r.fontSizePt > 0)) ||
          !(r.href === null || typeof r.href === 'string') ||
          (own(r,'fontFamily') && !(r.fontFamily === null || typeof r.fontFamily === 'string')) ||
          (own(r,'language') && !(r.language === null || (r.language && typeof r.language === 'object' && !Array.isArray(r.language) && Object.values(r.language).every(v=>typeof v==='string')))) ||
          (own(r,'fontSizeCsPt') && !(r.fontSizeCsPt === null || (typeof r.fontSizeCsPt === 'number' && Number.isFinite(r.fontSizeCsPt) && r.fontSizeCsPt > 0))) ||
          (own(r,'allCaps') && typeof r.allCaps !== 'boolean') ||
          (own(r,'letterSpacingPt') && !(r.letterSpacingPt === null || (typeof r.letterSpacingPt === 'number' && Number.isFinite(r.letterSpacingPt)))) ) {
        throw new Error('Invalid run field types at ' + where);
      }
    });
    {
      if (!Array.isArray(value.lineBreaks)) throw new Error('Invalid line-break inventory: ' + side);
      if (!Array.isArray(value.paragraphLayouts)) throw new Error('Invalid paragraph-layout inventory: ' + side);
      value.paragraphLayouts.forEach((item, i) => {
        const where = side + '.paragraphLayouts[' + i + ']';
        required(item, ['paragraphIndex','alignment','indentation'], where);
        if (!Number.isInteger(item.paragraphIndex) || item.paragraphIndex < 0 || typeof item.alignment !== 'string' || !item.indentation || typeof item.indentation !== 'object') throw new Error('Invalid paragraph-layout fields at ' + where);
      });
      value.lineBreaks.forEach((item, i) => {
        const where = side + '.lineBreaks[' + i + ']';
        required(item, ['paragraphIndex', 'textOffset', 'breakType', 'markerOrder'], where);
        if (!Number.isInteger(item.paragraphIndex) || item.paragraphIndex < 0 ||
            !Number.isInteger(item.textOffset) || item.textOffset < 0 || !Number.isInteger(item.markerOrder) || item.markerOrder < 0 ||
            item.breakType !== 'textWrapping') throw new Error('Invalid line-break fields at ' + where);
      });
    }
    value.images.forEach((r, i) => {
      const where = side + '.images[' + i + ']';
      required(r, ['assetPath', 'paragraphIndex', 'order', 'alt', 'textOffset', 'markerOrder', 'placement'], where);
      if (typeof r.assetPath !== 'string' || !r.assetPath ||
          !Number.isInteger(r.paragraphIndex) || r.paragraphIndex < 0 ||
          !Number.isInteger(r.order) || r.order < 0 || !Number.isInteger(r.textOffset) || r.textOffset < 0 || !Number.isInteger(r.markerOrder) || r.markerOrder < 0 ||
          !(r.alt === null || typeof r.alt === 'string') || !r.placement || typeof r.placement !== 'object' || !['inline','floating'].includes(r.placement.kind) || (r.placement.kind === 'floating' && r.placement.requiresVisualReview !== true)) {
        throw new Error('Invalid image field types at ' + where);
      }
    });
  }
  // Matching anchor metadata is not proof that HTML reproduces Word floating layout.
  if (source.images.some(image => image.placement.kind === 'floating') || output.images.some(image => image.placement.kind === 'floating')) {
    issues.push({kind:'floating-image-visual-review-required'});
  }
  {
    if (source.paragraphLayouts.length !== output.paragraphLayouts.length) issues.push({kind:'paragraph-layout-count',expected:source.paragraphLayouts.length,actual:output.paragraphLayouts.length});
    for (let i=0;i<Math.min(source.paragraphLayouts.length,output.paragraphLayouts.length);i++) {
      const a=source.paragraphLayouts[i], b=output.paragraphLayouts[i];
      for (const field of ['paragraphIndex','alignment']) if (a[field] !== b[field]) issues.push({kind:'paragraph-layout-mismatch',index:i,field,expected:a[field],actual:b[field]});
      for (const field of ['left','right','firstLine','hanging']) if ((a.indentation[field] ?? null) !== (b.indentation[field] ?? null)) issues.push({kind:'paragraph-indentation-mismatch',index:i,field,expected:a.indentation[field] ?? null,actual:b.indentation[field] ?? null});
      if (a.spacing !== undefined || b.spacing !== undefined) {
        if (!a.spacing || !b.spacing) issues.push({kind:'paragraph-spacing-missing',index:i});
        else for (const field of ['beforePt','afterPt','lineHeightPt']) if ((a.spacing[field] ?? null) !== (b.spacing[field] ?? null)) issues.push({kind:'paragraph-spacing-mismatch',index:i,field,expected:a.spacing[field] ?? null,actual:b.spacing[field] ?? null});
      }
    }
  }
  {
    if (source.lineBreaks.length !== output.lineBreaks.length) issues.push({kind:'line-break-count',expected:source.lineBreaks.length,actual:output.lineBreaks.length});
    for (let i=0;i<Math.min(source.lineBreaks.length,output.lineBreaks.length);i++) {
      for (const field of ['paragraphIndex','textOffset','breakType','markerOrder']) {
        if (source.lineBreaks[i][field] !== output.lineBreaks[i][field]) issues.push({kind:'line-break-mismatch',index:i,field,expected:source.lineBreaks[i][field],actual:output.lineBreaks[i][field]});
      }
    }
  }
  if (source.paragraphCount !== output.paragraphCount) issues.push({kind:'paragraph-count',expected:source.paragraphCount,actual:output.paragraphCount});
  for (const key of ['runs', 'images']) {
    if (source[key].length !== output[key].length) issues.push({kind: key + '-count', expected: source[key].length, actual: output[key].length});
    for (let i = 0; i < Math.min(source[key].length, output[key].length); i++) {
      const fields = key === 'runs' ? ['paragraphIndex', 'text', 'bold', 'italic', 'underline', 'color', 'fontSizePt', 'href', ...(['fontFamily','language','fontSizeCsPt','allCaps','letterSpacingPt'].filter(field=>own(source[key][i],field)||own(output[key][i],field)))] : ['assetPath', 'paragraphIndex', 'order', 'alt', 'textOffset', 'markerOrder', 'placement'];
      for (const field of fields) {
        const expected = source[key][i][field], actual = output[key][i][field];
        const equal = ['placement','language'].includes(field) ? JSON.stringify(expected) === JSON.stringify(actual) : (typeof expected === typeof actual && expected === actual);
        if (!equal) {
          issues.push({kind: key + '-mismatch', index: i, field, expected: source[key][i][field], actual: output[key][i][field]});
        }
      }
    }
  }
  return {ok: issues.length === 0, issues};
}
