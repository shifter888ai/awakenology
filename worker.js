export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
html[data-aw-theme="dark"] body.site-lang-en #a188dda404b603086d7b3027a1d90739 span[style*="background-color:#ffffff"],
html[data-aw-theme="dark"] body.site-lang-en #a188dda404b603086d7b3027a1d90739 span[style*="background-color: #ffffff"] {
  background-color: transparent !important;
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
  position: fixed; top: 10px; right: 54px; z-index: 2147483647;
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
      .on("head", { element(el) { el.append(theme + script + chineseScript, { html: true }); } })
      .transform(response);
  }
};