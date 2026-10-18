import { LANGUAGES } from "./validate-page-set.mjs";
import { inspectPageSet } from "./inspect-page-set.mjs";
import { buildLanguageRouteManifest, verifyLanguageRouteManifest } from "./language-route-manifest.mjs";
import { renderStaticShell } from "./static-shell.mjs";
import { verifyRenderedInventory } from "./inspect-page-set.mjs";

/**
 * Offline review coordinator. Returns static HTML only when source inspection,
 * caller-supplied rendered inventories, and language routes all pass.
 * The output inventory must eventually be produced by an independent parser;
 * this function is a workflow gate, not a security boundary or sanitizer.
 */
export async function generateReviewedPageSet({ pageSet, inputs, outputs }) {
  const inspection = await inspectPageSet(pageSet, inputs);
  if (!inspection.ok) return { ok: false, stage: "source-inspection", errors: inspection.errors, pages: {} };

  const routeManifest = buildLanguageRouteManifest(pageSet);
  if (!routeManifest.ok) return { ok: false, stage: "routes", errors: routeManifest.errors, pages: {} };

  const errors = [];
  for (const lang of LANGUAGES) {
    const output = outputs?.[lang];
    if (!output || typeof output !== "object") {
      errors.push(`${lang}: reviewed output is missing.`);
      continue;
    }
    const integrity = verifyRenderedInventory(inspection.pages[lang], output.inventory);
    errors.push(...integrity.errors.map(e => `${lang}: ${e}`));
  }
  if (errors.length) return { ok: false, stage: "content-integrity", errors, pages: {} };

  const renderedRoutes = Object.fromEntries(LANGUAGES.map(lang => [lang, {
    route: pageSet.pages[lang].route,
    alternates: routeManifest.pages[lang].alternates
  }]));
  const routeCheck = verifyLanguageRouteManifest(routeManifest, renderedRoutes);
  if (!routeCheck.ok) return { ok: false, stage: "route-verification", errors: routeCheck.errors, pages: {} };

  const pages = {};
  try {
    for (const lang of LANGUAGES) {
      const meta = pageSet.pages[lang];
      const output = outputs[lang];
      pages[lang] = {
        route: meta.route,
        html: renderStaticShell({
          language: lang,
          title: output.title ?? meta.title,
          description: output.description,
          route: meta.route,
          alternates: routeManifest.pages[lang].alternates,
          approvedHeader: output.approvedHeader,
          approvedFooter: output.approvedFooter,
          reviewedArticleHtml: output.reviewedArticleHtml,
          integrityApproved: true
        })
      };
    }
  } catch (error) {
    return { ok: false, stage: "render", errors: [String(error?.message ?? error)], pages: {} };
  }
  return { ok: true, stage: "review-ready-static-output", errors: [], pages, inspection, routeManifest };
}
