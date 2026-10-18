import test from "node:test";
import assert from "node:assert/strict";
import { buildLanguageRouteManifest, verifyLanguageRouteManifest } from "./language-route-manifest.mjs";

const set = { pages: Object.fromEntries(["en", "ja", "zh-Hant"].map((lang, i) => [lang, {
  title: lang, mode: "paste", source: "fixture", route: ["/English/example/", "/Japanese/example/", "/Chinese/example/"][i]
}])) };

test("derives all three reciprocal alternates from routes", () => {
  const manifest = buildLanguageRouteManifest(set);
  assert.equal(manifest.ok, true);
  assert.equal(verifyLanguageRouteManifest(manifest, manifest.pages).ok, true);
});
test("rejects missing language before manifest creation", () => {
  const broken = structuredClone(set); delete broken.pages.ja;
  assert.equal(buildLanguageRouteManifest(broken).ok, false);
});
test("detects a nonreciprocal alternate", () => {
  const manifest = buildLanguageRouteManifest(set);
  const rendered = structuredClone(manifest.pages);
  rendered.en.alternates.ja = "/wrong/";
  assert.equal(verifyLanguageRouteManifest(manifest, rendered).ok, false);
});
test("detects canonical route drift", () => {
  const manifest = buildLanguageRouteManifest(set);
  const rendered = structuredClone(manifest.pages);
  rendered.ja.route = "/other/";
  assert.equal(verifyLanguageRouteManifest(manifest, rendered).ok, false);
});
