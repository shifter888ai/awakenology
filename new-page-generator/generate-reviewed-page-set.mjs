import { LANGUAGES } from "./validate-page-set.mjs";
import { inspectPageSet } from "./inspect-page-set.mjs";
import { buildLanguageRouteManifest, verifyLanguageRouteManifest } from "./language-route-manifest.mjs";
import { renderStaticShell } from "./static-shell.mjs";
import { verifyRenderedInventory } from "./inspect-page-set.mjs";
import { inspectPastedHtml } from "./inspect-paste.mjs";
import { validateInventory } from "./content-inventory.mjs";
import { reviewPasteInventory } from "./review-paste-inventory.mjs";
import { compareRichContent } from "./compare-rich-content.mjs";
import { inspectRenderedRichContent } from "./inspect-rendered-rich-content.mjs";

/**
 * Offline review coordinator. Returns static HTML only when source inspection,
 * parsed rendered content, and language routes all pass. Output inventories are
 * derived from the actual reviewedArticleHtml, never trusted from caller input.
 * This remains a review gate, not a security boundary or a full HTML sanitizer.
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
    const rendered = inspectPastedHtml(output.reviewedArticleHtml, output.parser);
    if (!rendered.ok) {
      errors.push(...rendered.errors.map(e => `${lang}: rendered HTML: ${e}`));
      continue;
    }
    errors.push(...validateInventory(rendered.inventory).errors.map(e => `${lang}: rendered HTML: ${e}`));
    errors.push(...reviewPasteInventory(rendered.inventory).errors.map(e => `${lang}: rendered HTML: ${e}`));
    if (pageSet.pages[lang].mode === "docx") {
      try {
        const original = inspection.pages[lang].sourceRichInventory;
        if (!original?.ok) throw new Error("Original DOCX rich inventory unavailable.");
        const derived = inspectRenderedRichContent(output.reviewedArticleHtml, output.parser);
        if (!derived.ok) throw new Error(derived.errors.join("; "));
        const rich = compareRichContent(original, derived);
        errors.push(...rich.issues.map(issue => `${lang}: DOCX rich-content mismatch: ${JSON.stringify(issue)}`));
      } catch (error) {
        errors.push(`${lang}: DOCX rich-content verification blocked: ${String(error?.message ?? error)}`);
      }
      // This conservative extractor does not yet resolve relationships,
      // inherited styles, or full image provenance. Do not certify the pilot.
      errors.push(`${lang}: full DOCX rich-content provenance remains incomplete; review output blocked.`);
    } else if (output.sourceRichInventory !== undefined || output.renderedRichInventory !== undefined) {
      errors.push(`${lang}: caller-supplied rich inventories cannot establish independent source provenance.`);
    }
    const integrity = verifyRenderedInventory(inspection.pages[lang], rendered.inventory);
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
