import { handleEditorRequest } from "./src/editor-runtime.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // This entry point is intentionally restricted to its isolated workers.dev hostname.
    // It has no public-site fallback and no custom-domain routing configuration.
    if (!url.hostname.endsWith(".workers.dev")) {
      return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
    }
    return handleEditorRequest(request, env, url.hostname);
  }
};
