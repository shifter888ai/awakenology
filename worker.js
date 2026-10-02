export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/translate" && request.method === "POST") {
      try {
        const body = await request.json();
        const text = typeof body.text === "string" ? body.text.trim() : "";
        const source_lang = typeof body.source_lang === "string" ? body.source_lang : "english";
        const target_lang = typeof body.target_lang === "string" ? body.target_lang : "japanese";
        if (!text) return Response.json({ error: "Text is required." }, { status: 400 });
        if (text.length > 5000) return Response.json({ error: "Text is limited to 5,000 characters for this test." }, { status: 400 });
        const result = await env.AI.run("@cf/meta/m2m100-1.2b", { text, source_lang, target_lang });
        return Response.json(result);
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
      }
    }

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("content-type") || "";
    const pathname = new URL(request.url).pathname;
    const decodedPathname = decodeURIComponent(pathname);
    const isLanguageTocPage = decodedPathname === "/English/" || decodedPathname === "/Japanese/" || decodedPathname === "/Chinese/";
    const isChinesePage = decodedPathname === "/Chinese/" || decodedPathname === "/Coach_cn/" || (/[^\x00-\x7f]/.test(decodedPathname) && /[\u3400-\u9fff]/.test(decodedPathname) && !/[\u3040-\u30ff]/.test(decodedPathname));
    const legacyDarkPages = [
      "/What-Is-Hypnosis/",
      "/What-Is-Hypnotic-Reincarnation/",
      "/The-History-of-Reincarnation/",
      "/Multidimensional-Body-Complex-1-Single-Complex/",
      "/Multidimensional-Body-Complex-3-Multi-Complex/",
      "/What-is-The-Ultimate-Source/",
      "/What-does-The-Ultimate-Source-like/",
      "/What-is-Multidimensional-Space-Time/",
      "/What-is-Zero-Energy-Space/",
      "/アインシュタイン協議百年催眠実験/",
      "/意識強度とは/",
      "/意識強度検測点1自動意識制御領域/",
      "/意識強度検測点2自主意識領域/",
      "/意識強度検測点抽出検測データサンプル20190317/",
      "/人の多次元複合体構造1-単重複合体/",
      "/人の多次元複合体構造2-二重複合体霊-体/",
      "/伝統修行の五段階/"
    ];
    const isLegacyDarkPage = legacyDarkPages.includes(decodedPathname);
    if (!contentType.toLowerCase().includes("text/html")) return response;

    const theme = `<style id="awakenology-theme-style">
html[data-aw-theme="dark"] body,
html[data-aw-theme="dark"] #wb_root,
html[data-aw-theme="dark"] .wb_sbg {
  background-color: #121212 !important;
  color: #e8e8e8 !important;
}
html[data-aw-theme="dark"] body.awakenology-toc-page .wb_content {
  background-color: #121212 !important;
  color: #e8e8e8 !important;
}
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:#333333"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: #333333"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:#000000"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: #000000"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:#272626"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: #272626"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color:rgb(39, 38, 38)"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="color: rgb(39, 38, 38)"] {
  color: #e8e8e8 !important;
}
html[data-aw-theme="dark"] body.awakenology-chinese-page #a19c93e79d1100245860cc6f0d48686a, html[data-aw-theme="dark"] body.awakenology-chinese-page #a19c93e79d1100245860cc6f0d48686a > .wb_content { background: #2b2514 !important; background-color: #2b2514 !important; }
html[data-aw-theme="dark"] body.awakenology-chinese-page .wb_content {
  background-color: #121212 !important;
  color: #e8e8e8 !important;
}
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#41464b"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #41464b"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#333333"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #333333"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#000000"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #000000"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:#272626"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: #272626"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color:rgb(39, 38, 38)"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="color: rgb(39, 38, 38)"] {
  color: #e8e8e8 !important;
}
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background:#ffffff"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background: #ffffff"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background-color:#ffffff"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background-color: #ffffff"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background:rgb(255, 255, 255)"],
html[data-aw-theme="dark"] body.awakenology-chinese-page [style*="background: rgb(255, 255, 255)"] {
  background: #121212 !important;
  background-color: #121212 !important;
}
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background:#ffffff"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background: #ffffff"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background-color:#ffffff"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background-color: #ffffff"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background:rgb(255, 255, 255)"],
html[data-aw-theme="dark"] body.awakenology-legacy-dark-page [style*="background: rgb(255, 255, 255)"] {
  background: #121212 !important;
  background-color: #121212 !important;
}
html[data-aw-theme="dark"] p,
html[data-aw-theme="dark"] li,
html[data-aw-theme="dark"] h1,
html[data-aw-theme="dark"] h2,
html[data-aw-theme="dark"] h3,
html[data-aw-theme="dark"] h4,
html[data-aw-theme="dark"] h5,
html[data-aw-theme="dark"] h6,
html[data-aw-theme="dark"] .wb-stl-normal,
html[data-aw-theme="dark"] .wb-stl-footer {
  color: #e8e8e8 !important;
}
html[data-aw-theme="dark"] a { color: #9ecbff !important; }
#awakenology-theme-toggle {
  position: fixed; top: 10px; right: 10px; z-index: 2147483647;
  border: 1px solid #888; border-radius: 14px; width: 30px; height: 30px; padding: 4px;
  font: 18px/20px Arial, sans-serif; cursor: pointer;
  background: #fff; color: #222; box-shadow: 0 1px 4px #0004;
}
html[data-aw-theme="dark"] #awakenology-theme-toggle {
  background: #222; color: #eee; border-color: #777;
}
</style>
<style id="awakenology-cn-style">
#awakenology-cn-toggle {
  position: fixed; top: 10px; right: 48px; z-index: 2147483647;
  border: 1px solid #888; border-radius: 14px; min-width: 30px; height: 30px; padding: 4px 7px;
  font: 14px/20px Arial, sans-serif; cursor: pointer;
  background: #fff; color: #222; box-shadow: 0 1px 4px #0004;
}
html[data-aw-theme="dark"] #awakenology-cn-toggle {
  background: #222; color: #eee; border-color: #777;
}
</style>`;

    const script = `<script>
(function () {
  var KEY = "awakenology-theme";
  var saved = localStorage.getItem(KEY);
  var dark = saved === "dark";
  document.documentElement.setAttribute("data-aw-theme", dark ? "dark" : "light");
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("awakenology-theme-toggle")) return;
    var button = document.createElement("button");
    button.id = "awakenology-theme-toggle";
    button.type = "button";
    button.setAttribute("aria-label", "Switch background theme");
    button.textContent = dark ? "☀" : "☾";
    button.addEventListener("click", function () {
      dark = document.documentElement.getAttribute("data-aw-theme") !== "dark";
      document.documentElement.setAttribute("data-aw-theme", dark ? "dark" : "light");
      localStorage.setItem(KEY, dark ? "dark" : "light");
      button.textContent = dark ? "☀" : "☾";
    });
    document.body.appendChild(button);
  });
}());
</script>`;

    const translateStyle = `<style id="awakenology-translate-style">
#awakenology-ai-translate {
  position: fixed; top: 10px; right: 86px; z-index: 2147483647;
  border: 1px solid #888; border-radius: 14px; width: 30px; height: 30px; padding: 4px;
  font: 12px/20px Arial, sans-serif; font-weight: 700; cursor: pointer;
  background: #fff; color: #222; box-shadow: 0 1px 4px #0004;
}
html[data-aw-theme="dark"] #awakenology-ai-translate {
  background: #222; color: #eee; border-color: #777;
}
#awakenology-ai-translate-menu {
  position: fixed; top: 46px; right: 86px; z-index: 2147483647;
  display: none; min-width: 150px; padding: 6px;
  border: 1px solid #888; border-radius: 8px;
  background: #fff; color: #222; box-shadow: 0 2px 10px #0004;
  font: 14px/1.4 Arial, sans-serif;
}
#awakenology-ai-translate-menu.open { display: block; }
#awakenology-ai-translate-menu button {
  display: block; width: 100%; padding: 7px 9px; border: 0; border-radius: 5px;
  background: transparent; color: inherit; text-align: left; cursor: pointer;
  font: inherit;
}
#awakenology-ai-translate-menu button:hover { background: #eee; }
html[data-aw-theme="dark"] #awakenology-ai-translate-menu {
  background: #222; color: #eee; border-color: #777;
}
html[data-aw-theme="dark"] #awakenology-ai-translate-menu button:hover { background: #333; }
</style>`;

    const translateScript = `<script>
(function () {
  var languages = [
    ["english", "English"],
    ["japanese", "日本語"],
    ["chinese", "简体中文"],
    ["french", "Français"],
    ["german", "Deutsch"],
    ["spanish", "Español"],
    ["portuguese", "Português"],
    ["korean", "한국어"],
    ["russian", "Русский"],
    ["arabic", "العربية"]
  ];
  var button, menu, originalNodes = [], translating = false;
  var sourceLanguage = null;

  function getSourceLanguage() {
    if (sourceLanguage) return sourceLanguage;
    var lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (lang.indexOf("ja") === 0) sourceLanguage = "japanese";
    else if (lang.indexOf("zh") === 0) sourceLanguage = "chinese";
    else if (lang.indexOf("ko") === 0) sourceLanguage = "korean";
    else if (lang.indexOf("fr") === 0) sourceLanguage = "french";
    else if (lang.indexOf("de") === 0) sourceLanguage = "german";
    else if (lang.indexOf("es") === 0) sourceLanguage = "spanish";
    else if (lang.indexOf("pt") === 0) sourceLanguage = "portuguese";
    else if (lang.indexOf("ru") === 0) sourceLanguage = "russian";
    else if (lang.indexOf("ar") === 0) sourceLanguage = "arabic";
    else {
      var path = decodeURIComponent(location.pathname);
      if (path === "/Japanese/" || /[\u3040-\u30ff]/.test(path)) sourceLanguage = "japanese";
      else if (path === "/Chinese/" || path === "/Coach_cn/" || (/[^\x00-\x7f]/.test(path) && /[\u3400-\u9fff]/.test(path) && !/[\u3040-\u30ff]/.test(path))) sourceLanguage = "chinese";
      else sourceLanguage = "english";
    }
    return sourceLanguage;
  }

  function collectNodes() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [], node;
    while (node = walker.nextNode()) {
      var parent = node.parentElement;
      if (!node.nodeValue.trim() || !parent) continue;
      if (parent.closest("script, style, noscript, textarea, input, select, option, #awakenology-theme-toggle, #awakenology-cn-toggle, #awakenology-ai-translate, #awakenology-ai-translate-menu, .ignore-translate")) continue;
      nodes.push(node);
    }
    return nodes;
  }

  function setLanguage(target) {
    var map = {
      english: "en", japanese: "ja", chinese: "zh-CN", french: "fr",
      german: "de", spanish: "es", portuguese: "pt", korean: "ko",
      russian: "ru", arabic: "ar"
    };
    document.documentElement.setAttribute("lang", map[target] || "en");
  }

  async function translatePage(target) {
    if (translating || getSourceLanguage() === target) return;
    var nodes = originalNodes.length ? originalNodes : collectNodes();
    if (!nodes.length) return;

    translating = true;
    button.disabled = true;
    button.textContent = "…";
    menu.classList.remove("open");

    if (!originalNodes.length) {
      originalNodes = nodes.map(function (node) {
        return { node: node, text: node.nodeValue };
      });
    }

    try {
      for (var i = 0; i < originalNodes.length; i++) {
        var item = originalNodes[i];
        if (!item.node.isConnected) continue;
        var response = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: item.text,
            source_lang: getSourceLanguage(),
            target_lang: target
          })
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || "Translation failed.");
        item.node.nodeValue = data.translated_text || data.translation || data.response || item.text;
      }
      setLanguage(target);
      button.textContent = "文A";
    } catch (error) {
      for (var j = 0; j < originalNodes.length; j++) {
        if (originalNodes[j].node.isConnected) originalNodes[j].node.nodeValue = originalNodes[j].text;
      }
      setLanguage(getSourceLanguage());
      alert("AI Translate error: " + error.message);
    } finally {
      translating = false;
      button.disabled = false;
    }
  }

  function init() {
    if (document.getElementById("awakenology-ai-translate")) return;
    getSourceLanguage();

    button = document.createElement("button");
    button.id = "awakenology-ai-translate";
    button.type = "button";
    button.textContent = "文A";
    button.setAttribute("aria-label", "AI Translate");
    button.title = "AI Translate";

    menu = document.createElement("div");
    menu.id = "awakenology-ai-translate-menu";
    menu.className = "ignore-translate";
    menu.setAttribute("role", "menu");

    languages.forEach(function (item) {
      var option = document.createElement("button");
      option.type = "button";
      option.textContent = item[1];
      option.className = "ignore-translate";
      option.addEventListener("click", function () {
        translatePage(item[0]);
      });
      menu.appendChild(option);
    });

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      menu.classList.toggle("open");
    });
    menu.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    document.addEventListener("click", function () {
      menu.classList.remove("open");
    });

    button.className = "ignore-translate";
    document.body.appendChild(button);
    document.body.appendChild(menu);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
</script>`;

    const chineseScript = `<script type="module">
(function () {
  function looksChinesePage() {
    var text = document.body ? (document.body.innerText || "") : "";
    var han = (text.match(/[\u3400-\u9fff]/g) || []).length;
    var kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
    var signals = (text.match(/[的了是我你他她這这個个與与為为會会來来說说時时間间麼么沒没還还從从們们]/g) || []).length;
    return han >= 30 && kana === 0 && signals >= 2;
  }

  function init() {
    if (!looksChinesePage() || document.getElementById("awakenology-cn-toggle")) return;

    import("https://cdn.jsdelivr.net/npm/opencc-js@1.4.1/dist/esm/full.js").then(function (OpenCC) {
      var saved = localStorage.getItem("awakenology-cn-variant");
      var bodyText = document.body.innerText || "";
      var simplifiedSignals = (bodyText.match(/[汉马龙门国东来后时这说还没为与个们]/g) || []).length;
      var traditionalSignals = (bodyText.match(/[漢馬龍門國東來後時這說還沒為與個們]/g) || []).length;
      var current = simplifiedSignals > traditionalSignals ? "cn" : "tw";
      var activeVariant = current;
      var target = saved === "cn" || saved === "tw" ? saved : current;

      var toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
      var toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });
      var handler = null;

      function convertTo(variant) {
        if (handler) handler.restore();
        var converter = variant === "tw" ? toTraditional : toSimplified;
        var fromLang = variant === "tw" ? "zh-CN" : "zh-TW";
        var toLang = variant === "tw" ? "zh-TW" : "zh-CN";
        document.documentElement.setAttribute("lang", fromLang);
        document.body.setAttribute("lang", fromLang);
        handler = OpenCC.HTMLConverter(converter, document.body, fromLang, toLang);
        handler.convert();
        activeVariant = variant;
        localStorage.setItem("awakenology-cn-variant", variant);
        button.textContent = variant === "tw" ? "简" : "繁";
        button.setAttribute("aria-label", variant === "tw" ? "Convert to Simplified Chinese" : "Convert to Traditional Chinese");
      }

      var button = document.createElement("button");
      button.id = "awakenology-cn-toggle";
      button.className = "ignore-opencc ignore-translate";
      button.type = "button";
      button.textContent = target === "tw" ? "简" : "繁";
      button.setAttribute("aria-label", target === "tw" ? "Convert to Simplified Chinese" : "Convert to Traditional Chinese");
      button.title = "繁 / 简";
      button.addEventListener("click", function () {
        var next = activeVariant === "tw" ? "cn" : "tw";
        convertTo(next);
      });
      document.body.appendChild(button);

      if (target !== current) convertTo(target);
    }).catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
</script>`;

    return new HTMLRewriter()
      .on("body", { element(el) {
        var current = el.getAttribute("class") || "";
        if (isLanguageTocPage) current += " awakenology-toc-page";
        if (isLegacyDarkPage) current += " awakenology-legacy-dark-page";
        if (isChinesePage) current += " awakenology-chinese-page";
        el.setAttribute("class", current);
      } })
      .on("head", { element(el) { el.append(theme + script + translateStyle + translateScript + chineseScript, { html: true }); } })
      .transform(response);
  }
};