import { LANGUAGES, validatePageSet } from "./validate-page-set.mjs";

/**
 * Derive alternates from the complete validated set, never from manually
 * entered per-page links. No publishing or filesystem changes.
 */
export function buildLanguageRouteManifest(pageSet) {
  const checked = validatePageSet(pageSet);
  if (!checked.ok) return { ok: false, errors: checked.errors, pages: {} };
  const alternates = Object.fromEntries(LANGUAGES.map(lang => [lang, pageSet.pages[lang].route]));
  const pages = Object.fromEntries(LANGUAGES.map(lang => [lang, {
    route: pageSet.pages[lang].route,
    alternates: { ...alternates }
  }]));
  return { ok: true, errors: [], pages };
}

/** Check a rendered page's route and complete reciprocal alternate set. */
export function verifyLanguageRouteManifest(manifest, rendered) {
  const errors = [];
  if (!manifest?.ok) return { ok: false, errors: ["A validated language route manifest is required."] };
  for (const lang of LANGUAGES) {
    const expected = manifest.pages?.[lang];
    const actual = rendered?.[lang];
    if (!actual || actual.route !== expected?.route) errors.push(`${lang}: missing or changed canonical route.`);
    for (const target of LANGUAGES) {
      if (actual?.alternates?.[target] !== manifest.pages?.[target]?.route) {
        errors.push(`${lang}: missing or nonreciprocal ${target} alternate.`);
      }
    }
    if (actual?.alternates && Object.keys(actual.alternates).some(key => !LANGUAGES.includes(key))) {
      errors.push(`${lang}: unexpected alternate language.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
