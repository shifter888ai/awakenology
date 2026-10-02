export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) return response;

    const theme = `<style id="awakenology-theme-style">
html[data-aw-theme="dark"] body,
html[data-aw-theme="dark"] #wb_root,
html[data-aw-theme="dark"] .wb_sbg {
  background-color: #121212 !important;
  color: #e8e8e8 !important;
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
  border: 1px solid #888; border-radius: 14px; padding: 4px 9px;
  font: 12px/1.2 Arial, sans-serif; cursor: pointer;
  background: #fff; color: #222; box-shadow: 0 1px 4px #0004;
}
html[data-aw-theme="dark"] #awakenology-theme-toggle {
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
    button.textContent = dark ? "LIGHT" : "DARK";
    button.addEventListener("click", function () {
      dark = document.documentElement.getAttribute("data-aw-theme") !== "dark";
      document.documentElement.setAttribute("data-aw-theme", dark ? "dark" : "light");
      localStorage.setItem(KEY, dark ? "dark" : "light");
      button.textContent = dark ? "LIGHT" : "DARK";
    });
    document.body.appendChild(button);
  });
}());
</script>`;

    return new HTMLRewriter()
      .on("head", { element(el) { el.append(theme + script, { html: true }); } })
      .transform(response);
  }
};