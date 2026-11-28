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
async function startGitHubLogin(request, env, editorHost) {
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.EDITOR_GITHUB_ALLOWED_USER || !env.EDITOR_SESSION_SECRET || env.EDITOR_SESSION_SECRET.length < 32) {
    return new Response("GitHub OAuth is not configured for the private editor.", { status: 503, headers: { "cache-control": "no-store" } });
  }
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = toBase64Url(stateBytes);
  const callback = "https://" + editorHost + "/auth/github/callback";
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
async function finishGitHubLogin(request, env, editorHost) {
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
      body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET, code, redirect_uri: "https://" + editorHost + "/auth/github/callback", state: suppliedState })
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
      "location": "https://" + editorHost + "/editor/",
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
  if (length > 20000000) return jsonResponse({ error: "Reviewed page and assets exceed the 20 MB publishing limit." }, 413);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON request." }, 400); }
  const path = body.path;
  const reviewedHtml = body.reviewedHtml;
  const baselineSha256 = body.baselineSha256;
  const assets = body.assets === undefined ? [] : body.assets;
  if (!Array.isArray(assets) || assets.length > 100) return jsonResponse({ error: "Invalid asset manifest (maximum 100 images)." }, 400);
  const assetPaths = new Set();
  let assetBytes = 0;
  for (const asset of assets) {
    // Page folder names may contain Chinese, Japanese, or other Unicode characters.
    // Validate path segments and the generated filename separately instead of restricting
    // the entire repository path to ASCII.
    const assetPath = asset && typeof asset.path === "string" ? asset.path : "";
    const assetParts = assetPath.split("/");
    const assetNameValid = /^docx-(?:image-[0-9]{3}|[a-f0-9]{16}-image-[0-9]{3})\.(?:png|jpg|gif|webp)$/.test(assetParts[assetParts.length - 1] || "");
    const assetFolderValid = assetParts.length >= 3 && assetParts[assetParts.length - 2] === "assets" &&
      !assetPath.startsWith("/") &&
      !assetParts.some(part => !part || part === "." || part === ".." || part.includes("\\") || /[\u0000-\u001f]/.test(part));
    if (!asset || !assetFolderValid || !assetNameValid || typeof asset.contentBase64 !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(asset.contentBase64) ||
        asset.contentBase64.length % 4 !== 0 || assetPaths.has(asset.path)) return jsonResponse({ error: "Invalid or duplicate image asset." }, 400);
    assetPaths.add(asset.path);
    assetBytes += asset.contentBase64.length;
  }
  if (assetBytes > 19000000) return jsonResponse({ error: "Image assets exceed publishing limit." }, 413);

  if (typeof path !== "string" || path.length > 500 || path.startsWith("/") || path.includes("\\") ||
      !/\.html?$/i.test(path) || path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
    return jsonResponse({ error: "Invalid repository-relative article path." }, 400);
  }
  if (typeof reviewedHtml !== "string" || reviewedHtml.length > 1500000 || !/<html[\s>]/i.test(reviewedHtml) || !/class\s*=\s*["'][^"']*\barticle\b/i.test(reviewedHtml)) {
    return jsonResponse({ error: "Reviewed HTML is missing the full document or .article element, or exceeds the 1.5 MB limit." }, 400);
  }
  if (assets.length && (typeof path !== "string" || assets.some(asset => !asset.path.startsWith(path.replace(/[^/]+$/, "") + "assets/") || !reviewedHtml.includes("/" + asset.path.split("/").map(encodeURIComponent).join("/"))))) return jsonResponse({ error: "Image asset paths do not match the reviewed page." }, 400);
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
    const treeItems = [{ path, mode: "100644", type: "blob", content: reviewedHtml }];
    for (const asset of assets) {
      const existing = await githubApi("/repos/" + GITHUB_REPO + "/contents/" + asset.path.split("/").map(encodeURIComponent).join("/") + "?ref=main", token, { method: "GET" }).catch(error => {
        if (String(error.message).includes("GitHub API 404:")) return null;
        throw error;
      });
      if (existing && !asset.path.startsWith("Internal/New-Article/assets/")) throw new Error("Asset path already exists: " + asset.path);
      const blob = await githubApi("/repos/" + GITHUB_REPO + "/git/blobs", token, { method: "POST", body: JSON.stringify({ content: asset.contentBase64, encoding: "base64" }) });
      treeItems.push({ path: asset.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const baseCommit = await githubApi("/repos/" + GITHUB_REPO + "/git/commits/" + mainRef.object.sha, token);
    const tree = await githubApi("/repos/" + GITHUB_REPO + "/git/trees", token, { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems }) });
    const commit = await githubApi("/repos/" + GITHUB_REPO + "/git/commits", token, { method: "POST", body: JSON.stringify({ message: (current ? "Update generated page: " : "Add generated page: ") + path, tree: tree.sha, parents: [mainRef.object.sha] }) });
    await githubApi("/repos/" + GITHUB_REPO + "/git/refs/heads/" + branch, token, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
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

async function publishReviewedPage(request, env, editorHost) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return jsonResponse({ error: "JSON content type required." }, 415);
  const origin = request.headers.get("origin");
  if (origin && origin !== "https://" + editorHost) return jsonResponse({ error: "Cross-origin publishing is not allowed." }, 403);
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



export async function handleEditorRequest(request, env, editorHost) {
  const url = new URL(request.url);
  if (!editorHost || url.hostname !== editorHost) return new Response("Not found", { status: 404 });
  const isEditorPath = url.pathname === "/editor" || url.pathname.startsWith("/editor/");
  const isEditorApi = url.pathname === "/api/editor/create-draft-pr";
  const isPublishApi = url.pathname === "/api/editor/publish-page";
  if (url.pathname === "/robots.txt") {
    return new Response("User-agent: *\\nDisallow: /\\n", {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600", "X-Robots-Tag": "noindex, nofollow, noarchive" }
    });
  }
  if (url.pathname === "/auth/github" && request.method === "GET") return startGitHubLogin(request, env, editorHost);
  if (url.pathname === "/auth/github/callback" && request.method === "GET") return finishGitHubLogin(request, env, editorHost);
  if (url.pathname === "/auth/logout" && request.method === "POST") {
    return new Response(null, { status: 302, headers: {
      "location": "https://" + editorHost + "/auth/github",
      "set-cookie": "awakenology_editor_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
      "cache-control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }});
  }
  if (isEditorPath || isEditorApi || isPublishApi || url.pathname === "/") {
    const authenticated = await verifyEditorSession(request, env);
    if (!authenticated) {
      if (isEditorApi || isPublishApi) {
        const response = jsonResponse({ error: "Sign in with the authorized GitHub account to continue." }, 401);
        response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
        return response;
      }
      return authRedirect("https://" + editorHost + "/auth/github");
    }
    if (isEditorApi) return createReviewedDraftPR(request, env);
    if (isPublishApi) return publishReviewedPage(request, env, editorHost);
    if (url.pathname === "/") return authRedirect("https://" + editorHost + "/editor/");
    const editorResponse = await env.ASSETS.fetch(request);
    const editorHeaders = new Headers(editorResponse.headers);
    editorHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    editorHeaders.set("Cache-Control", "private, no-store");
    return new Response(editorResponse.body, {status:editorResponse.status,statusText:editorResponse.statusText,headers:editorHeaders});
  }
  return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive", "Cache-Control": "no-store" } });
}
