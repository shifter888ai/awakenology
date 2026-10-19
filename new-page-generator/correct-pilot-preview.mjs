// Preview-only visual corrections requested during human review.
// Does not alter source extraction, source inventories, or integrity comparisons.
export function correctPilotPreview(html) {
  let candidate = String(html ?? "");
  candidate = candidate.replace(/<(p|h[1-6]|li|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, tag, attrs, inner) => {
    const plain = inner.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!["1）界是什麼？", "3）界與界的關係？"].includes(plain)) return whole;
    const correction = "margin-left:0!important;padding-left:0!important;text-indent:0!important;text-align:left!important";
    const next = /\bstyle=(["'])(.*?)\1/i.test(attrs)
      ? attrs.replace(/\bstyle=(["'])(.*?)\1/i, (_m, q, value) => "style=" + q + value + ";" + correction + q)
      : attrs + ' style="' + correction + '"';
    return "<" + tag + next + ">" + inner + "</" + tag + ">";
  });
  // Replace only dark neutral six-digit hex text colours. Keep chromatic emphasis.
  candidate = candidate.replace(/(^|[;{\s"'])color\s*:\s*#([0-9a-f]{6})\b/gi, (whole, prefix, hex) => {
    const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    return Math.max(...rgb) - Math.min(...rgb) <= 8 && Math.max(...rgb) < 128
      ? prefix + "color:var(--fg)"
      : whole;
  });
  return candidate;
}
