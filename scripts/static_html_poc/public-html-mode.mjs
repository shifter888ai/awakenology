export function publicHtmlMode(value) {
  if (value === undefined || value === null || value === '' || value === 'runtime') return 'runtime';
  throw new Error('Unapproved public HTML mode');
}
