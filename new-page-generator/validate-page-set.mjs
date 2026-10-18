/**
 * Phase 3 input-contract validator. Pure, dependency-free; no publishing or file writes.
 * Reject missing languages, duplicate routes, unsupported input modes and unsafe routes.
 */
export const LANGUAGES = Object.freeze(["en", "ja", "zh-Hant"]);
const MODES = new Set(["docx", "paste"]);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export function validatePageSet(pageSet) {
  const errors = [];
  if (!pageSet || typeof pageSet !== "object" || Array.isArray(pageSet)) {
    return { ok: false, errors: ["Page set must be an object."] };
  }
  if (!pageSet.pages || typeof pageSet.pages !== "object" || Array.isArray(pageSet.pages)) {
    return { ok: false, errors: ["pages must be an object keyed by language."] };
  }
  const routes = new Set();
  for (const lang of LANGUAGES) {
    if (!hasOwn(pageSet.pages, lang)) {
      errors.push(`Missing required language: ${lang}.`);
      continue;
    }
    const p = pageSet.pages[lang];
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      errors.push(`${lang}: page must be an object.`);
      continue;
    }
    if (typeof p.title !== "string" || !p.title.trim()) errors.push(`${lang}: title is required.`);
    if (!MODES.has(p.mode)) errors.push(`${lang}: mode must be docx or paste.`);
    if (typeof p.source !== "string" || !p.source.trim()) errors.push(`${lang}: source reference is required.`);
    if (typeof p.route !== "string" || !/^\/[\p{L}\p{N}_().%\-\/]+\/$/u.test(p.route) || p.route.includes("//") || p.route.includes("..") || /%(?:2f|5c|2e|00)/i.test(p.route)) {
      errors.push(`${lang}: route must be a safe absolute trailing-slash path.`);
    } else if (routes.has(p.route)) {
      errors.push(`${lang}: duplicate route ${p.route}.`);
    } else routes.add(p.route);
  }
  for (const key of Object.keys(pageSet.pages)) {
    if (!LANGUAGES.includes(key)) errors.push(`Unexpected language key: ${key}.`);
  }
  return { ok: errors.length === 0, errors };
}
