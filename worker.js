/* Awakenology Runtime Implementation — Full Automated Migration & Redesign Pipeline v2
 * Runtime/global implementation lives here.
 * Source migration rules: The-Master.md
 * Verification rules: AUDIT.md
 * Inventory/state: migration-manifest.json
 */
const EDITOR_HOST = "editor.awakenology.space";
const GITHUB_REPO = "shifter888ai/awakenology";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function base64UrlBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function base64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
}
function toBase64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function derLength(length) {
  if (length < 128) return Uint8Array.of(length);
  const bytes = [];
  for (let n = length; n > 0; n = Math.floor(n / 256)) bytes.unshift(n & 255);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}
function pkcs1ToPkcs8(pkcs1) {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const algorithmIdentifier = Uint8Array.of(0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00);
  const octetLength = derLength(pkcs1.length);
  const octetHeader = Uint8Array.of(0x04, ...octetLength);
  const body = new Uint8Array(version.length + algorithmIdentifier.length + octetHeader.length + pkcs1.length);
  body.set(version, 0);
  body.set(algorithmIdentifier, version.length);
  body.set(octetHeader, version.length + algorithmIdentifier.length);
  body.set(pkcs1, version.length + algorithmIdentifier.length + octetHeader.length);
  const sequenceLength = derLength(body.length);
  const result = new Uint8Array(1 + sequenceLength.length + body.length);
  result[0] = 0x30; result.set(sequenceLength, 1); result.set(body, 1 + sequenceLength.length);
  return result;
}
function pemPrivateKeyBytes(pemValue) {
  const match = pemValue.trim().match(/-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]+?)-----END (RSA )?PRIVATE KEY-----/);
  if (!match) throw new Error("GitHub App private key must be a PEM private key.");
  const bytes = Uint8Array.from(atob(match[2].replace(/\s/g, "")), c => c.charCodeAt(0));
  return match[1] ? pkcs1ToPkcs8(bytes) : bytes;
}
function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    if (item.slice(0, index).trim() === name) return item.slice(index + 1).trim();
  }
  return "";
}
function cookieHeader(name, value, maxAge) {
  return name + "=" + value + "; Path=/; Max-Age=" + maxAge + "; Secure; HttpOnly; SameSite=Lax";
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signSession(payload, secret) {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return encoded + "." + toBase64Url(new Uint8Array(signature));
}
async function verifyEditorSession(request, env) {
  const secret = env.EDITOR_SESSION_SECRET;
  const allowedUser = (env.EDITOR_GITHUB_ALLOWED_USER || "").trim().toLowerCase();
  const cookie = getCookie(request, "awakenology_editor_session");
  if (!secret || secret.length < 32 || !allowedUser || !cookie) return false;
  try {
    const parts = cookie.split(".");
    if (parts.length !== 2) return false;
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlBytes(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid) return false;
    const payload = base64UrlJson(parts[0]);
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000) &&
      typeof payload.login === "string" && payload.login.toLowerCase() === allowedUser;
  } catch {
    return false;
  }
}
function authRedirect(url) {
  return Response.redirect(url, 302);
}
async function startGitHubLogin(request, env) {
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.EDITOR_GITHUB_ALLOWED_USER || !env.EDITOR_SESSION_SECRET || env.EDITOR_SESSION_SECRET.length < 32) {
    return new Response("GitHub OAuth is not configured for the private editor.", { status: 503, headers: { "cache-control": "no-store" } });
  }
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = toBase64Url(stateBytes);
  const callback = "https://" + EDITOR_HOST + "/auth/github/callback";
  const target = new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  target.searchParams.set("redirect_uri", callback);
  target.searchParams.set("scope", "read:user");
  target.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      "location": target.toString(),
      "set-cookie": cookieHeader("awakenology_editor_oauth_state", state, 600),
      "cache-control": "no-store"
    }
  });
}
async function finishGitHubLogin(request, env) {
  const url = new URL(request.url);
  const suppliedState = url.searchParams.get("state") || "";
  const expectedState = getCookie(request, "awakenology_editor_oauth_state");
  const clearState = "awakenology_editor_oauth_state=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
  if (!suppliedState || !expectedState || suppliedState !== expectedState) {
    return new Response("GitHub sign-in could not be verified. Please try again.", { status: 400, headers: { "set-cookie": clearState, "cache-control": "no-store" } });
  }
  if (url.searchParams.has("error")) return new Response("GitHub sign-in was cancelled or denied. You can return to the editor and try again when ready.", { status: 403, headers: { "set-cookie": clearState, "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" } });
  const code = url.searchParams.get("code") || "";
  if (!code || !env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET ||
      !env.EDITOR_GITHUB_ALLOWED_USER || !env.EDITOR_SESSION_SECRET || env.EDITOR_SESSION_SECRET.length < 32) {
    return new Response("GitHub OAuth is not fully configured.", { status: 503, headers: { "set-cookie": clearState, "cache-control": "no-store" } });
  }
  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json", "user-agent": "Awakenology-Private-Editor" },
      body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET, code, redirect_uri: "https://" + EDITOR_HOST + "/auth/github/callback", state: suppliedState })
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error("GitHub did not issue an OAuth token.");
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { "authorization": "Bearer " + tokenData.access_token, "accept": "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "Awakenology-Private-Editor" }
    });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || typeof user.login !== "string") throw new Error("Could not verify the GitHub account.");
    if (user.login.toLowerCase() !== env.EDITOR_GITHUB_ALLOWED_USER.trim().toLowerCase()) {
      const denied = new Response("This GitHub account is not authorized to use the Awakenology editor.", {
        status: 403,
        headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }
      });
      denied.headers.append("set-cookie", clearState);
      denied.headers.append("set-cookie", "awakenology_editor_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax");
      return denied;
    }
    const session = await signSession({ login: user.login, exp: Math.floor(Date.now() / 1000) + 28800 }, env.EDITOR_SESSION_SECRET);
    const response = new Response(null, { status: 302, headers: {
      "location": "https://" + EDITOR_HOST + "/editor/",
      "cache-control": "no-store"
    }});
    response.headers.append("set-cookie", clearState);
    response.headers.append("set-cookie", cookieHeader("awakenology_editor_session", session, 28800));
    return response;
  } catch {
    return new Response("GitHub sign-in failed. Please retry.", { status: 502, headers: { "set-cookie": clearState, "cache-control": "no-store" } });
  }
}
async function createGitHubInstallationToken(env) {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App secrets are not configured in Cloudflare yet.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = toBase64Url(new TextEncoder().encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: String(env.GITHUB_APP_ID) })));
  const keyBytes = pemPrivateKeyBytes(env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(header + "." + claims));
  const appJwt = header + "." + claims + "." + toBase64Url(new Uint8Array(signature));
  const response = await fetch("https://api.github.com/app/installations/" + encodeURIComponent(env.GITHUB_APP_INSTALLATION_ID) + "/access_tokens", {
    method: "POST",
    headers: { "authorization": "Bearer " + appJwt, "accept": "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json", "user-agent": "Awakenology-Private-Editor" },
    body: "{}"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) throw new Error("GitHub App could not issue an installation token: " + (data.message || response.status));
  return data.token;
}
async function githubApi(path, token, options = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...options,
    headers: { "authorization": "Bearer " + token, "accept": "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json", "user-agent": "Awakenology-Private-Editor", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("GitHub API " + response.status + ": " + (data.message || "request failed"));
  return data;
}
function sha256Hex(value) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then(bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join(""));
}
function decodeGitHubFile(content) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
async function createReviewedDraftPR(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return jsonResponse({ error: "JSON content type required." }, 415);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 600000) return jsonResponse({ error: "Reviewed HTML payload is too large." }, 413);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON request." }, 400); }
  const path = body.path;
  const reviewedHtml = body.reviewedHtml;
  const baselineSha256 = body.baselineSha256;
  if (typeof path !== "string" || path.length > 500 || path.startsWith("/") || path.includes("\\") ||
      !/\.html?$/i.test(path) || path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
    return jsonResponse({ error: "Invalid repository-relative article path." }, 400);
  }
  if (typeof reviewedHtml !== "string" || reviewedHtml.length > 1500000 || !/<html[\s>]/i.test(reviewedHtml) || !/class\s*=\s*["'][^"']*\barticle\b/i.test(reviewedHtml)) {
    return jsonResponse({ error: "Reviewed HTML is missing the full document or .article element, or exceeds the 1.5 MB limit." }, 400);
  }
  if (typeof baselineSha256 !== "string" || !(baselineSha256 === "NEW" || /^[a-f0-9]{64}$/i.test(baselineSha256))) return jsonResponse({ error: "Missing valid baseline fingerprint." }, 400);
  try {
    const token = await createGitHubInstallationToken(env);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const apiPath = "/repos/" + GITHUB_REPO + "/contents/" + encodedPath + "?ref=main";
    const getResponse = await fetch("https://api.github.com" + apiPath, {
      headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "Awakenology-Private-Editor" }
    });
    let current = null;
    if (getResponse.ok) current = await getResponse.json();
    else if (getResponse.status !== 404) {
      const problem = await getResponse.json().catch(() => ({}));
      return jsonResponse({ error: "Could not check the target page: " + (problem.message || getResponse.status) }, 502);
    }
    if (baselineSha256 === "NEW" && current) return jsonResponse({ error: "The target page now exists on main. Reload it and review the replacement before creating a draft PR." }, 409);
    if (baselineSha256 !== "NEW" && !current) return jsonResponse({ error: "The target page no longer exists on main. Reload and review it before creating a draft PR." }, 409);
    if (current) {
      if (current.type !== "file" || current.encoding !== "base64" || !current.content) return jsonResponse({ error: "The target is not a supported text file." }, 409);
      const currentHtml = decodeGitHubFile(current.content);
      if (reviewedHtml === currentHtml) return jsonResponse({ error: "There are no file changes to submit." }, 409);
      if (await sha256Hex(currentHtml) !== baselineSha256.toLowerCase()) return jsonResponse({ error: "The target page changed on main after it was loaded. Reload it and review again." }, 409);
    }
    const mainRef = await githubApi("/repos/" + GITHUB_REPO + "/git/ref/heads/main", token);
    const slug = path.replace(/\.html?$/i, "").split("/").map(part => part.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")).filter(Boolean).join("-").slice(-45) || "article";
    const branch = "page-generator/" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + crypto.randomUUID().slice(0, 8) + "-" + slug;
    await githubApi("/repos/" + GITHUB_REPO + "/git/refs", token, { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + branch, sha: mainRef.object.sha }) });
    const payload = { message: (current ? "Update generated page: " : "Add generated page: ") + path, content: toBase64(new TextEncoder().encode(reviewedHtml)), branch };
    if (current) payload.sha = current.sha;
    await githubApi("/repos/" + GITHUB_REPO + "/contents/" + encodedPath, token, { method: "PUT", body: JSON.stringify(payload) });
    const pr = await githubApi("/repos/" + GITHUB_REPO + "/pulls", token, {
      method: "POST",
      body: JSON.stringify({
        title: (current ? "Update page: " : "Add page: ") + path,
        head: branch,
        base: "main",
        draft: true,
        maintainer_can_modify: true,
        body: "## Summary\nGenerated page submitted through the Awakenology page generator.\n\n- Page: " + path + "\n- Preview reviewed before submission\n- Draft only: inspect the rendered page and diff before merging\n\nThis change does not deploy until the PR is merged."
      })
    });
    return jsonResponse({ ok: true, number: pr.number, pullRequestUrl: pr.html_url, branch });
  } catch (error) {
    return jsonResponse({ error: error && error.message ? error.message : "Could not create the draft pull request." }, 502);
  }
}

async function publishReviewedPage(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return jsonResponse({ error: "JSON content type required." }, 415);
  const origin = request.headers.get("origin");
  if (origin && origin !== "https://" + EDITOR_HOST) return jsonResponse({ error: "Cross-origin publishing is not allowed." }, 403);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid request." }, 400); }
  const path = body.path, html = body.html, baselineSha256 = body.baselineSha256;
  if (typeof path !== "string" || path.length > 500 || path.startsWith("/") || path.includes("\\") ||
      !/\.html?$/i.test(path) || path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
    return jsonResponse({ error: "Enter a valid repository-relative .html page path." }, 400);
  }
  if (typeof html !== "string" || html.length > 1500000 || !/<html[\s>]/i.test(html) ||
      !/<article\b[^>]*class=["'][^"']*\barticle\b/i.test(html)) {
    return jsonResponse({ error: "Generated page is invalid or exceeds the 1.5 MB limit." }, 400);
  }
  if (typeof baselineSha256 !== "string" || !(baselineSha256 === "NEW" || /^[a-f0-9]{64}$/i.test(baselineSha256))) {
    return jsonResponse({ error: "Missing page version check." }, 400);
  }
  try {
    const token = await createGitHubInstallationToken(env);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const apiPath = "/repos/" + GITHUB_REPO + "/contents/" + encodedPath + "?ref=main";
    const getResponse = await fetch("https://api.github.com" + apiPath, {
      headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "Awakenology-Private-Editor" }
    });
    let current = null;
    if (getResponse.ok) current = await getResponse.json();
    else if (getResponse.status !== 404) {
      const problem = await getResponse.json().catch(() => ({}));
      return jsonResponse({ error: "Could not check the current page: " + (problem.message || getResponse.status) }, 502);
    }
    if (baselineSha256 === "NEW" && current) return jsonResponse({ error: "That URL already exists. Load it as an existing page before publishing." }, 409);
    if (baselineSha256 !== "NEW" && !current) return jsonResponse({ error: "This page no longer exists. Reload and review it again." }, 409);
    if (current) {
      if (current.type !== "file" || current.encoding !== "base64" || !current.content) return jsonResponse({ error: "The target is not a supported text file." }, 409);
      const currentHtml = decodeGitHubFile(current.content);
      if (await sha256Hex(currentHtml) !== baselineSha256.toLowerCase()) return jsonResponse({ error: "The page changed on GitHub after it was loaded. Reload it and review again." }, 409);
      if (html === currentHtml) return jsonResponse({ error: "There are no changes to publish." }, 409);
    }
    const payload = { message: "Publish reviewed page: " + path, content: toBase64(new TextEncoder().encode(html)), branch: "main" };
    if (current) payload.sha = current.sha;
    const saved = await githubApi("/repos/" + GITHUB_REPO + "/contents/" + encodedPath, token, { method: "PUT", body: JSON.stringify(payload) });
    const isIndexPage = /index\.html?$/i.test(path);
    const finalPath = path.replace(/index\.html?$/i, "").split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return jsonResponse({ ok: true, path, commit: saved.commit && saved.commit.sha, url: "https://awakenology.space/" + finalPath + (isIndexPage && finalPath ? "/" : "") });
  } catch (error) {
    return jsonResponse({ error: error && error.message ? error.message : "Publishing failed." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isEditorHost = url.hostname === EDITOR_HOST;
    const isEditorPath = url.pathname === "/editor" || url.pathname.startsWith("/editor/");
    const isEditorApi = url.pathname === "/api/editor/create-draft-pr";
    const isPublishApi = url.pathname === "/api/editor/publish-page";
    if (isEditorHost) {
      if (url.pathname === "/auth/github" && request.method === "GET") return startGitHubLogin(request, env);
      if (url.pathname === "/auth/github/callback" && request.method === "GET") return finishGitHubLogin(request, env);
      if (url.pathname === "/auth/logout" && request.method === "POST") {
        return new Response(null, { status: 302, headers: {
          "location": "https://" + EDITOR_HOST + "/auth/github",
          "set-cookie": "awakenology_editor_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
          "cache-control": "no-store"
        }});
      }
      if (isEditorPath || isEditorApi || isPublishApi || url.pathname === "/") {
        const authenticated = await verifyEditorSession(request, env);
        if (!authenticated) {
          if (isEditorApi || isPublishApi) return jsonResponse({ error: "Sign in with the authorized GitHub account to continue." }, 401);
          return authRedirect("https://" + EDITOR_HOST + "/auth/github");
        }
        if (isEditorApi) return createReviewedDraftPR(request, env);
        if (isPublishApi) return publishReviewedPage(request, env);
        if (url.pathname === "/") return authRedirect("https://" + EDITOR_HOST + "/editor/");
        return env.ASSETS.fetch(request);
      }
    }
    // Never expose the editor or publishing API on the public website or temporary preview hosts.
    if (isEditorPath || isEditorApi || isPublishApi) return new Response("Not found", { status: 404 });
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("content-type") || "";
    const pathname = new URL(request.url).pathname;
    const decodedPathname = decodeURIComponent(pathname);
    const isLanguageTocPage = decodedPathname === "/English/" || decodedPathname === "/Japanese/" || decodedPathname === "/Chinese/";
    const isChinesePage = decodedPathname === "/Chinese/" || decodedPathname === "/Coach_cn/" || (/[^\x00-\x7f]/.test(decodedPathname) && /[\u3400-\u9fff]/.test(decodedPathname) && !/[\u3040-\u30ff]/.test(decodedPathname));
    const legacyDarkPages = [
      "/What-Is-Hypnosis/","/What-Is-Hypnotic-Reincarnation/","/The-History-of-Reincarnation/","/Multidimensional-Body-Complex-1-Single-Complex/","/Multidimensional-Body-Complex-3-Multi-Complex/","/What-is-The-Ultimate-Source/","/What-does-The-Ultimate-Source-like/","/What-is-Multidimensional-Space-Time/","/What-is-Zero-Energy-Space/","/Energy-Consumption-and-Transformation/","/アインシュタイン協議百年催眠実験/","/意識強度とは/","/意識強度検測点1自動意識制御領域/","/意識強度検測点2自主意識領域/","/意識強度検測点抽出検測データサンプル20190317/","/人の多次元複合体構造1-単重複合体/","/人の多次元複合体構造2-二重複合体霊-体/","/伝統修行の五段階/"
    ];
    const isLegacyDarkPage = legacyDarkPages.includes(decodedPathname);
    const seoDescriptions = {
      "/Destruction-Occurs-in-an-Instant/": "Awakenology — an account of how 3,000 Domain team members were instantaneously captured 10,000 years ago on Earth.",
      "/ai-search/": "Search the Awakenology site or ask questions about its material using AI.",
      "/三十六計/": "《三十六計》：中國傳統兵法三十六計的全文整理。",
      "/人の多次元複合体構造1-単重複合体/": "人の多次元複合体構造（1）----単重複合体。肉体、霊体、霊串、霊核などの構造を整理。",
      "/人の多次元複合体構造2-二重複合体霊-体/": "人の多次元複合体構造（2）----二重複合体「霊+体」。霊と体の関係と各複合体を整理。",
      "/人の多次元複合体構造3-多重複合体/": "人の多次元複合体構造（3）----多重複合体。多次元的な複合体構造について整理。",
      "/人的多次元複合體結構6-人體18規則與章程/": "人的多次元複合體結構（6）----人體18規則與章程，整理人體資訊模組系統及其管理與技術規則。",
      "/個體現象界與集體現象界/": "個體現象界與集體現象界：介紹自由意識所創造的個體現象界與集體現象界。",
      "/多重時空是什麽/": "多重時空是什麽：介紹界、空間、時空及不同空間的時間特性。",
      "/意識強度檢測點抽樣檢測資料樣本/": "意識強度檢測點：抽樣檢測資料樣本20190317，包含第1至9區的檢測資料。",
      "/愛因斯坦協議百年催眠實驗/": "愛因斯坦協議：百年催眠實驗，2025年公開發布的信息披露內容。",
      "/摧毀只是一瞬間/": "摧毀只是一瞬間：記錄一萬年前同領地三千名隊員被瞬間捕捉的催眠偷襲事件。",
      "/時間是什麽/": "時間是什麽：從深層靈界、淺層靈界與物質界的角度介紹時間遊戲及其規則。",
      "/本源喜歡什麽/": "本源喜歡什麽：以問答形式討論本源、遊戲及自由意識。",
      "/本源是什麽/": "本源是什麽：從與本源合一的觀察，描述本源的無限性、唯一性與不可定義性。",
      "/空間是什麽/": "空間是什麽：從本源與意識的角度討論空間、界與不同層次的存在。",
      "/零能量空間是什麽/": "零能量空間是什麽：介紹零能量空間及其相關概念。"
    };
    const seoDescription = seoDescriptions[decodedPathname] || "";
    const seoNoindex = decodedPathname === "/ai-search/";
    var seoHasDescription = false;
    var seoHasCanonical = false;
    var seoCanonicalCount = 0;
    var seoHasRobots = false;
    var seoTitle = "";
    var seoTitleText = "";
    var seoDescriptionMeta = seoDescription;
    var seoHasOgTitle = false;
    var seoHasOgDescription = false;
    var seoHasOgUrl = false;
    var seoHasOgType = false;
    var seoHasOgSiteName = false;
    var seoHasOgImage = false;
    const seoDefaultOgImage = "https://images.squarespace-cdn.com/content/v1/5e46c1ddfed24d662efc3817/6e1d6965-c6b2-49d0-971e-4d42f9bcfaaa/Cosmic%2BEye.jpg";
    const seoCanonicalPath = decodedPathname === "/" || decodedPathname.endsWith("/") || decodedPathname.endsWith(".html") ? decodedPathname : decodedPathname + "/";
    var seoCanonical = "https://awakenology.space" + encodeURI(seoCanonicalPath);
    if (!contentType.toLowerCase().includes("text/html")) return response;

    const theme = `<style id="awakenology-theme-style">
html[data-aw-theme="dark"] body,html[data-aw-theme="dark"] #wb_root,html[data-aw-theme="dark"] .wb_sbg{background-color:#0D0F12!important;color:#ffffff!important}
html[data-aw-theme="dark"] body.awakenology-toc-page .wb_content{background-color:#0D0F12!important;color:#ffffff!important}
body.awakenology-toc-page #wb_main_a188dda41444018c179704becd58d6e8,body.awakenology-toc-page #wb_main_a188dda414440213c8768efbfc4fa4d8,body.awakenology-toc-page #wb_main_a188dda4144403b540310ab683472666{padding-top:18px!important}
body.awakenology-toc-page h2.wb-stl-heading2{margin:0 0 12px!important;font-family:Georgia,"Times New Roman",serif!important;font-size:34px!important;font-weight:400!important;line-height:1.2!important}
body.awakenology-toc-page .wb-stl-heading2 + p{margin-top:0!important;margin-bottom:26px!important;color:#666!important;letter-spacing:.03em}
body.awakenology-lang-en #a1912b6e909c0001619736f255cd2f4e a[href="/English/"],body.awakenology-lang-en #a1912b6e909c0001619736f255cd2f4e a[href="/English/"] span,body.awakenology-lang-ja #a1912b6e909c0001619736f255cd2f4e a[href="/Japanese/"],body.awakenology-lang-ja #a1912b6e909c0001619736f255cd2f4e a[href="/Japanese/"] span,body.awakenology-lang-zh #a1912b6e909c0001619736f255cd2f4e a[href="/Chinese/"],body.awakenology-lang-zh #a1912b6e909c0001619736f255cd2f4e a[href="/Chinese/"] span{color:#fff!important;opacity:1!important;visibility:visible!important;text-decoration:underline!important;text-decoration-color:#fff!important;text-decoration-thickness:2px!important;text-underline-offset:5px!important}
body.awakenology-toc-page #a1912b6e909c0001619736f255cd2f4e a{margin:0 6px!important;transition:text-decoration-color .15s ease!important}
body.awakenology-toc-page #a1912b6e909c0001619736f255cd2f4e a:hover{color:#fff!important;text-decoration:underline!important;text-decoration-color:#fff!important;text-underline-offset:5px!important}
html[data-aw-theme="dark"] body.awakenology-toc-page .wb-stl-heading2 + p{color:#b8b8c3!important}
@media (max-width:700px){body.awakenology-toc-page #wb_main_a188dda41444018c179704becd58d6e8,body.awakenology-toc-page #wb_main_a188dda414440213c8768efbfc4fa4d8,body.awakenology-toc-page #wb_main_a188dda4144403b540310ab683472666{padding-top:10px!important}body.awakenology-toc-page h2.wb-stl-heading2{font-size:29px!important;margin-bottom:10px!important}body.awakenology-toc-page .wb-stl-heading2 + p{margin-bottom:20px!important}}
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:#333333"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: #333333"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:#000000"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: #000000"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:#272626"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: #272626"],html[data-aw-theme="dark"] [style*="color:#1f3864"],html[data-aw-theme="dark"] [style*="color: #1f3864"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:#1f3864"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: #1f3864"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:rgb(39, 38, 38)"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: rgb(39, 38, 38)"]{color:#ffffff!important}
html[data-aw-theme="dark"] body.awakenology-chinese-page #a19c93e79d1100245860cc6f0d48686a,html[data-aw-theme="dark"] body.awakenology-chinese-page #a19c93e79d1100245860cc6f0d48686a > .wb_content{background:#2b2514!important;background-color:#2b2514!important}
html[data-aw-theme="dark"] body.awakenology-chinese-page .wb_content{background-color:#0D0F12!important;color:#ffffff!important}
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#41464b"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #41464b"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#333333"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #333333"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#000000"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #000000"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#272626"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #272626"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:rgb(39, 38, 38)"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: rgb(39, 38, 38)"]{color:#ffffff!important}
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background:#ffffff"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background: #ffffff"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background-color:#ffffff"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background-color: #ffffff"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background:rgb(255, 255, 255)"],html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background: rgb(255, 255, 255)"]{background:#0D0F12!important;background-color:#0D0F12!important}
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background:#ffffff"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background: #ffffff"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background-color:#ffffff"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background-color: #ffffff"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background:rgb(255, 255, 255)"],html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background: rgb(255, 255, 255)"]{background:#0D0F12!important;background-color:#0D0F12!important}
html[data-aw-theme="dark"] body.site-lang-en #a19e7e93bc1d0a3dd101e0022a644444 > .wb_content{background:#2b2514!important;background-color:#2b2514!important}
html[data-aw-theme="dark"] p,html[data-aw-theme="dark"] li,html[data-aw-theme="dark"] h1,html[data-aw-theme="dark"] h2,html[data-aw-theme="dark"] h3,html[data-aw-theme="dark"] h4,html[data-aw-theme="dark"] h5,html[data-aw-theme="dark"] h6,html[data-aw-theme="dark"] .wb-stl-normal,html[data-aw-theme="dark"] .wb-stl-footer{color:#ffffff!important}
html[data-aw-theme="dark"] body.site-lang-en #a188dda404b603086d7b3027a1d90739 span[style*="background-color:#ffffff"],html[data-aw-theme="dark"] body.site-lang-en #a188dda404b603086d7b3027a1d90739 span[style*="background-color: #ffffff"]{background-color:transparent!important;color:#ffffff!important}
html[data-aw-theme="dark"] a{color:#818cf8!important}
html[data-aw-theme="dark"] a.brand,html[data-aw-theme="dark"] a.brand span,html[data-aw-theme="dark"] a.brand .brand-symbol{color:#ffffff!important}
html:not([data-aw-theme="dark"]) a.brand,html:not([data-aw-theme="dark"]) a.brand span,html:not([data-aw-theme="dark"]) a.brand .brand-symbol{color:#0D0F12!important}
#awakenology-theme-toggle{position:fixed;top:10px;right:10px;z-index:2147483647;border:1px solid #888;border-radius:14px;width:30px;height:30px;padding:4px;font:18px/20px "Segoe UI Symbol",Arial,sans-serif;cursor:pointer;background:#fff;color:#171920;box-shadow:0 1px 4px #0004}
html[data-aw-theme="dark"] #awakenology-theme-toggle{background:#171920;color:#eee;border-color:#777}

#awakenology-return-top{position:fixed;right:10px;bottom:10px;z-index:2147483647;border:1px solid #888;border-radius:14px;width:30px;height:30px;padding:4px;font:18px/20px Arial,sans-serif;cursor:pointer;background:#fff;color:#171920;box-shadow:0 1px 4px #0004;display:none}
html[data-aw-theme="dark"] #awakenology-return-top{background:#171920;color:#eee;border-color:#777}
footer .footer-inner{max-width:760px!important;margin:0 auto!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;gap:10px!important;color:inherit!important;font-size:13px!important}footer .footer-links{display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;flex-wrap:wrap!important;margin:0!important}footer .contact-icon,footer .disclaimer-icon{display:inline-flex!important;width:24px!important;height:24px!important;align-items:center!important;justify-content:center!important;font-size:20px!important;line-height:1!important;text-decoration:none!important}footer .contact-icon:hover,footer .disclaimer-icon:hover{text-decoration:none!important}

:root{--aw-accent:#6366c9;--aw-bg:#ffffff;--aw-text:#0D0F12;--aw-muted:#626270}
html[data-aw-theme="dark"]{--aw-accent:#818cf8;--aw-bg:#0D0F12;--aw-text:#ffffff;--aw-muted:#b8b8c3}
html[data-aw-theme="dark"] #awakenology-theme-toggle,html[data-aw-theme="dark"] #awakenology-return-top{border-color:#34343b}
.site-header a.brand{display:inline-flex!important;align-items:center!important;gap:9px!important;color:#0D0F12!important;text-decoration:none!important}
.site-header a.brand .brand-symbol{display:block;width:29px;height:29px;flex:0 0 29px;color:inherit!important}
html[data-aw-theme="dark"] .site-header a.brand,html[data-aw-theme="dark"] .site-header a.brand .brand-symbol{color:#fff!important}
</style>
<style id="awakenology-cn-style">
#awakenology-cn-toggle{position:fixed;top:10px;right:54px;z-index:2147483647;border:1px solid #888;border-radius:14px;min-width:30px;height:30px;padding:4px 7px;font:14px/20px Arial,sans-serif;cursor:pointer;background:#fff;color:#222;box-shadow:0 1px 4px #0004}
html[data-aw-theme="dark"] #awakenology-cn-toggle{background:#222;color:#eee;border-color:#777}
</style>`;

    const script = `<script>
(function(){var KEY="awakenology-theme";var saved=localStorage.getItem(KEY);var dark=saved!=="light";document.documentElement.setAttribute("data-aw-theme",dark?"dark":"light");document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll("a.reddit-icon[href]").forEach(function(link){link.title=link.href});if(!document.getElementById("awakenology-theme-toggle")&&!document.getElementById("theme-toggle")&&!document.querySelector(".theme-toggle")){var button=document.createElement("button");button.id="awakenology-theme-toggle";button.type="button";button.setAttribute("aria-label","Switch background theme");button.textContent=dark?"☀︎":"☾︎";button.addEventListener("click",function(){dark=document.documentElement.getAttribute("data-aw-theme")!=="dark";document.documentElement.setAttribute("data-aw-theme",dark?"dark":"light");localStorage.setItem(KEY,dark?"dark":"light");button.textContent=dark?"☀︎":"☾︎"});document.body.appendChild(button)}if(document.getElementById("awakenology-return-top"))return;var topButton=document.createElement("button");topButton.id="awakenology-return-top";topButton.type="button";topButton.setAttribute("aria-label","Return to top");topButton.title="Return to top";topButton.textContent="↑";function updateTop(){topButton.style.display=window.scrollY>300?"block":"none"}topButton.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"})});window.addEventListener("scroll",updateTop,{passive:true});updateTop();document.body.appendChild(topButton)})}());
</script>`;

    const chineseScript = `<script type="module">\n(function(){function looksChinesePage(){var text=document.body?(document.body.innerText||""):"";var han=(text.match(/[\\u3400-\\u9fff]/g)||[]).length;var kana=(text.match(/[\\u3040-\\u30ff]/g)||[]).length;var signals=(text.match(/[的了是我你他她這这個个與与為为會会來来說说時时間间麼么沒没還还從从們们]/g)||[]).length;return han>=30&&kana===0&&signals>=2}\nfunction init(){if(!(document.body.classList.contains("awakenology-chinese-page")||looksChinesePage())||document.getElementById("awakenology-cn-toggle"))return;import("https://cdn.jsdelivr.net/npm/opencc-js@1.4.1/dist/esm/full.js").then(function(module){var OpenCC=module.default||module;var saved=localStorage.getItem("awakenology-cn-variant");var originalBody=document.body.innerHTML;var originalTitle=document.title;var activeVariant="tw";var target=saved==="cn"?"cn":"tw";var toSimplified=OpenCC.Converter({from:"tw",to:"cn"});var toTraditional=OpenCC.Converter({from:"cn",to:"tw"});\nfunction convertTextNodes(converter){var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var nodes=[];var node;while(node=walker.nextNode())nodes.push(node);nodes.forEach(function(n){if(n.parentElement&&n.parentElement.closest("#awakenology-cn-toggle"))return;if(n.nodeValue&&n.nodeValue.trim())n.nodeValue=converter(n.nodeValue)});document.title=converter(document.title)}\nfunction applyVariant(variant){var themeButton=document.getElementById("awakenology-theme-toggle");var topButton=document.getElementById("awakenology-return-top");document.body.innerHTML=originalBody;document.title=originalTitle;activeVariant=variant;if(variant==="cn")convertTextNodes(toSimplified);else convertTextNodes(toTraditional);document.documentElement.setAttribute("lang",variant==="cn"?"zh-CN":"zh-Hant");document.body.setAttribute("lang",variant==="cn"?"zh-CN":"zh-Hant");localStorage.setItem("awakenology-cn-variant",variant);button.textContent=variant==="tw"?"简":"繁";button.setAttribute("aria-label",variant==="tw"?"Convert to Simplified Chinese":"Convert to Traditional Chinese");if(themeButton)document.body.appendChild(themeButton);if(topButton)document.body.appendChild(topButton);document.body.appendChild(button)}\nvar button=document.createElement("button");button.id="awakenology-cn-toggle";button.className="ignore-opencc ignore-translate";button.type="button";button.textContent=target==="tw"?"简":"繁";button.setAttribute("aria-label",target==="tw"?"Convert to Simplified Chinese":"Convert to Traditional Chinese");button.title="繁 / 简";button.addEventListener("click",function(){applyVariant(activeVariant==="tw"?"cn":"tw")});document.body.appendChild(button);if(target==="cn")applyVariant("cn")}).catch(function(error){console.error("Awakenology Chinese toggle failed:",error)})}\nif(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init()}());\n</script>`;

    return new HTMLRewriter()
      .on("footer.site-footer .footer-inner > span:last-child",{element(el){el.setInnerContent("© 2017–"+new Date().getUTCFullYear()+" Awakenology");}})
      .on("link",{element(el){var rel=(el.getAttribute("rel")||"").toLowerCase().split(/\\s+/);if(rel.includes("icon")||rel.includes("apple-touch-icon"))el.remove()}})
      .on("a.brand",{element(el){if(decodedPathname!=="/" && (el.getAttribute("href")||"")==="/"){el.prepend('<svg class="brand-symbol" viewBox="0 0 100 100" role="img" aria-label="Circled A" style="transform:rotate(5deg);transform-origin:center"><path d="M17 80 A44 44 0 1 1 26.7 87.3" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="butt"/><path d="M27 87 L50 20 L72 77 L58 59 Q52 54 46 55" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',{html:true});}}})
      .on("body",{element(el){var current=el.getAttribute("class")||"";if(isLanguageTocPage)current+=" awakenology-toc-page";if(decodedPathname==="/English/")current+=" awakenology-lang-en";if(decodedPathname==="/Japanese/")current+=" awakenology-lang-ja";if(decodedPathname==="/Chinese/")current+=" awakenology-lang-zh";if(isLegacyDarkPage)current+=" awakenology-legacy-dark-page";if(isChinesePage)current+=" awakenology-chinese-page";el.setAttribute("class",current)}})
      .on("head",{element(el){
        el.onEndTag(function(endTag){
          var title=seoTitleText.trim();
          var og=[];
          if(!seoHasOgTitle&&title)og.push("<meta property=\"og:title\" content=\""+title.replace(/&/g,"&amp;").replace(/"/g,"&quot;")+"\">");
          if(!seoHasOgDescription&&seoDescriptionMeta)og.push("<meta property=\"og:description\" content=\""+seoDescriptionMeta.replace(/&/g,"&amp;").replace(/"/g,"&quot;")+"\">");
          if(!seoHasOgImage)og.push("<meta property=\"og:image\" content=\""+seoDefaultOgImage+"\">");
          if(!seoHasOgUrl)og.push("<meta property=\"og:url\" content=\""+seoCanonical+"\">");
          if(!seoHasOgType)og.push("<meta property=\"og:type\" content=\"website\">");
          if(!seoHasOgSiteName)og.push("<meta property=\"og:site_name\" content=\"Awakenology\">");
          if(og.length)endTag.before(og.join(""),{html:true});
          if(seoDescription&&!seoHasDescription)endTag.before("<meta name=\"description\" content=\""+seoDescription.replace(/&/g,"&amp;").replace(/"/g,"&quot;")+"\">",{html:true});
          if(!seoHasCanonical&&decodedPathname!="/ai-search/")endTag.before("<link rel=\"canonical\" href=\""+seoCanonical+"\">",{html:true});
          if(seoNoindex&&!seoHasRobots)endTag.before("<meta name=\"robots\" content=\"noindex,follow\">",{html:true});
          if(decodedPathname==="/")endTag.before("<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"WebSite\",\"name\":\"Awakenology\",\"url\":\"https://awakenology.space/\"}</script>",{html:true});
          endTag.before(theme+script+chineseScript+"<link rel=\"icon\" type=\"image/png\" href=\"/gallery/favicons/favicon.png\">",{html:true});
        });
      }})
      .on("title",{element(el){el.onEndTag(function(){seoTitle=seoTitleText.trim();});}})
      .on("title",{text(text){seoTitleText+=text.text;}})
      .on("meta",{element(el){
        var name=(el.getAttribute("name")||"").toLowerCase();
        if(name==="description"){seoHasDescription=true;var descriptionContent=el.getAttribute("content")||"";if(!descriptionContent.trim()&&seoDescription){el.setAttribute("content",seoDescription);seoDescriptionMeta=seoDescription;}else{seoDescriptionMeta=descriptionContent||seoDescriptionMeta;}}
        if(name==="robots")seoHasRobots=true;
        var prop=(el.getAttribute("property")||"").toLowerCase();
        var ogContent=(el.getAttribute("content")||"").trim();
        if(prop==="og:title"){
          if(!ogContent||seoHasOgTitle){el.remove();return;}
          seoHasOgTitle=true;
        }
        if(prop==="og:description"){
          if(!ogContent||seoHasOgDescription){el.remove();return;}
          seoHasOgDescription=true;
        }
        if(prop==="og:image"){
          if(seoHasOgImage){el.remove();return;}
          seoHasOgImage=true;
          if(!ogContent)el.setAttribute("content",seoDefaultOgImage);
        }
        if(prop==="og:url"){
          if(seoHasOgUrl){el.remove();return;}
          seoHasOgUrl=true;
          el.setAttribute("content",seoCanonical);
        }
        if(prop==="og:type"){
          if(seoHasOgType){el.remove();return;}
          seoHasOgType=true;
          if(!ogContent)el.setAttribute("content","website");
        }
        if(prop==="og:site_name"){
          if(seoHasOgSiteName){el.remove();return;}
          seoHasOgSiteName=true;
          if(!ogContent)el.setAttribute("content","Awakenology");
        }
      }})
      .on("link",{element(el){var rel=(el.getAttribute("rel")||"").toLowerCase().split(/\s+/);if(rel.includes("canonical")){seoHasCanonical=true;if(decodedPathname!=="/ai-search/"){if(seoCanonicalCount===0){el.setAttribute("href",seoCanonical);seoCanonicalCount++;}else{el.remove();}}}}})
      .transform(response);
  }
};
