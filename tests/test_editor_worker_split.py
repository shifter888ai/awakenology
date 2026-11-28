import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "wrangler.editor.jsonc").read_text(encoding="utf-8"))
RUNTIME = (ROOT / "src/editor-runtime.js").read_text(encoding="utf-8")
EDITOR_WORKER = (ROOT / "editor-worker.js").read_text(encoding="utf-8")
PUBLIC_WORKER = (ROOT / "worker.js").read_text(encoding="utf-8")
EDITOR_FILES = ("index.html", "generator.html", "html-generator.html", "shared-editing-core.js")


class EditorWorkerSplitTests(unittest.TestCase):
    def test_editor_config_is_workers_dev_only(self):
        self.assertTrue(CONFIG["workers_dev"])
        self.assertEqual(CONFIG["name"], "awakenology-editor-staging")
        self.assertNotIn("routes", CONFIG)
        self.assertNotIn("custom_domain", CONFIG)
        self.assertEqual(CONFIG["assets"]["base_path"], "/editor")
        self.assertTrue(CONFIG["assets"]["run_worker_first"])
        self.assertEqual(CONFIG["assets"]["directory"], "./dist-editor/")
        self.assertNotIn("vars", CONFIG)

    def test_dedicated_worker_has_no_public_fallback(self):
        self.assertIn('url.hostname.endsWith(".workers.dev")', EDITOR_WORKER)
        self.assertIn("return handleEditorRequest(request, env, url.hostname)", EDITOR_WORKER)
        self.assertNotIn('from "./worker.js"', EDITOR_WORKER)

    def test_runtime_authenticates_assets_and_both_apis(self):
        self.assertIn("verifyEditorSession(request, env)", RUNTIME)
        self.assertIn('url.pathname === "/api/editor/create-draft-pr"', RUNTIME)
        self.assertIn('url.pathname === "/api/editor/publish-page"', RUNTIME)
        self.assertIn("}, 401)", RUNTIME)
        self.assertIn('editorHeaders.set("Cache-Control", "private, no-store")', RUNTIME)
        self.assertIn('return new Response("Not found", { status: 404', RUNTIME)

    def test_public_worker_keeps_editor_deny_list(self):
        self.assertIn("handleEditorRequest(request, env, EDITOR_HOST)", PUBLIC_WORKER)
        self.assertIn("if (isEditorPath || isEditorApi || isPublishApi)", PUBLIC_WORKER)
        self.assertIn('return new Response("Not found", { status: 404 })', PUBLIC_WORKER)

    def test_editor_page_urls_and_allow_list_are_preserved(self):
        for filename in EDITOR_FILES:
            self.assertTrue((ROOT / "editor" / filename).is_file())
        for filename in ("index.html", "generator.html", "html-generator.html"):
            page = (ROOT / "editor" / filename).read_text(encoding="utf-8")
            self.assertIn("/editor/", page)

    def test_build_copies_only_the_four_editor_files(self):
        spec = importlib.util.spec_from_file_location(
            "build_editor", ROOT / "scripts/static_html_poc/build_editor.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp:
            destination = module.build(Path(temp) / "bundle")
            self.assertEqual(
                sorted(path.name for path in destination.iterdir()),
                sorted(EDITOR_FILES),
            )


if __name__ == "__main__":
    unittest.main()
