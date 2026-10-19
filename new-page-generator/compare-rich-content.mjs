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
    required(value, ['runs', 'images', 'lineBreaks', 'paragraphCount'], side);
    if (!Array.isArray(value.runs) || !Array.isArray(value.images) || !Number.isInteger(value.paragraphCount) || value.paragraphCount < 0) throw new Error('Invalid inventory: ' + side);
    value.runs.forEach((r, i) => {
      const where = side + '.runs[' + i + ']';
      required(r, ['paragraphIndex', 'text', 'bold', 'italic', 'underline', 'color', 'fontSizePt', 'href'], where);
      if (!Number.isInteger(r.paragraphIndex) || r.paragraphIndex < 0 || typeof r.text !== 'string' || typeof r.bold !== 'boolean' ||
          typeof r.italic !== 'boolean' || typeof r.underline !== 'boolean' ||
          !(r.color === null || typeof r.color === 'string') || !(r.fontSizePt === null || (typeof r.fontSizePt === 'number' && Number.isFinite(r.fontSizePt) && r.fontSizePt > 0)) ||
          !(r.href === null || typeof r.href === 'string')) {
        throw new Error('Invalid run field types at ' + where);
      }
    });
    {
      if (!Array.isArray(value.lineBreaks)) throw new Error('Invalid line-break inventory: ' + side);
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
      required(r, ['assetPath', 'paragraphIndex', 'order', 'alt', 'textOffset', 'markerOrder'], where);
      if (typeof r.assetPath !== 'string' || !r.assetPath ||
          !Number.isInteger(r.paragraphIndex) || r.paragraphIndex < 0 ||
          !Number.isInteger(r.order) || r.order < 0 || !Number.isInteger(r.textOffset) || r.textOffset < 0 || !Number.isInteger(r.markerOrder) || r.markerOrder < 0 ||
          !(r.alt === null || typeof r.alt === 'string')) {
        throw new Error('Invalid image field types at ' + where);
      }
    });
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
      const fields = key === 'runs' ? ['paragraphIndex', 'text', 'bold', 'italic', 'underline', 'color', 'href'] : ['assetPath', 'paragraphIndex', 'order', 'alt', 'textOffset', 'markerOrder'];
      for (const field of fields) {
        if (typeof source[key][i][field] !== typeof output[key][i][field] || source[key][i][field] !== output[key][i][field]) {
          issues.push({kind: key + '-mismatch', index: i, field, expected: source[key][i][field], actual: output[key][i][field]});
        }
      }
    }
  }
  return {ok: issues.length === 0, issues};
}
