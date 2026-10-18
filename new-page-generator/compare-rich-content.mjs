// Compare source and output rich-content inventories without normalizing authorial details.
// Expected runs: [{text, bold, italic, underline, color, href}] in document order.
// Expected images: [{assetPath, paragraphIndex, order, alt}] in document order.
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const required = (o, keys, where) => {
  if (!o || typeof o !== 'object' || keys.some(k => !own(o, k))) {
    throw new Error('Incomplete rich-content inventory at ' + where);
  }
};
export function compareRichContent(source, output) {
  const issues = [];
  for (const [side, value] of [['source', source], ['output', output]]) {
    required(value, ['runs', 'images'], side);
    if (!Array.isArray(value.runs) || !Array.isArray(value.images)) throw new Error('Invalid inventory: ' + side);
    value.runs.forEach((r, i) => {
      const where = side + '.runs[' + i + ']';
      required(r, ['text', 'bold', 'italic', 'underline', 'color', 'href'], where);
      if (typeof r.text !== 'string' || typeof r.bold !== 'boolean' ||
          typeof r.italic !== 'boolean' || typeof r.underline !== 'boolean' ||
          !(r.color === null || typeof r.color === 'string') ||
          !(r.href === null || typeof r.href === 'string')) {
        throw new Error('Invalid run field types at ' + where);
      }
    });
    value.images.forEach((r, i) => {
      const where = side + '.images[' + i + ']';
      required(r, ['assetPath', 'paragraphIndex', 'order', 'alt'], where);
      if (typeof r.assetPath !== 'string' || !r.assetPath ||
          !Number.isInteger(r.paragraphIndex) || r.paragraphIndex < 0 ||
          !Number.isInteger(r.order) || r.order < 0 ||
          !(r.alt === null || typeof r.alt === 'string')) {
        throw new Error('Invalid image field types at ' + where);
      }
    });
  }
  for (const key of ['runs', 'images']) {
    if (source[key].length !== output[key].length) issues.push({kind: key + '-count', expected: source[key].length, actual: output[key].length});
    for (let i = 0; i < Math.min(source[key].length, output[key].length); i++) {
      const fields = key === 'runs' ? ['text', 'bold', 'italic', 'underline', 'color', 'href'] : ['assetPath', 'paragraphIndex', 'order', 'alt'];
      for (const field of fields) {
        if (typeof source[key][i][field] !== typeof output[key][i][field] || source[key][i][field] !== output[key][i][field]) {
          issues.push({kind: key + '-mismatch', index: i, field, expected: source[key][i][field], actual: output[key][i][field]});
        }
      }
    }
  }
  return {ok: issues.length === 0, issues};
}
