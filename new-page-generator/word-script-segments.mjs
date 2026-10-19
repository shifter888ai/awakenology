const eastAsianScript = /[\u3000-\u303f\u3040-\u30ff\u3100-\u312f\u3130-\u318f\u31a0-\u31bf\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/u;
const complexScript = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Ethiopic}]/u;
const commonScript = /\p{Script=Common}/u;

export function classifyWordScript(character, hint = null) {
  if (commonScript.test(character) && !/\s/u.test(character) && hint === "eastAsia") return "eastAsia";
  if (commonScript.test(character) && !/\s/u.test(character) && hint === "cs") return "cs";
  if (eastAsianScript.test(character)) return "eastAsia";
  if (complexScript.test(character)) return "cs";
  return "ascii";
}

export function wordFontFamily(families, script = "ascii") {
  if (typeof families === "string") return families;
  if (!families || typeof families !== "object" || Array.isArray(families)) return null;
  const order = script === "eastAsia" ? ["eastAsia","hAnsi","ascii","cs"] :
    script === "cs" ? ["cs","hAnsi","ascii","eastAsia"] : ["ascii","hAnsi","cs","eastAsia"];
  return order.map(key=>families[key]).find(Boolean) ?? null;
}

export function splitWordScriptSegments(text, run = {}) {
  if (typeof text !== "string") throw new TypeError("Word text must be a string.");
  const families = run.fontFamily;
  const scriptSensitive = Boolean(families && typeof families === "object" && !Array.isArray(families)) ||
    (run.boldCs !== undefined && run.boldCs !== run.bold) ||
    (run.italicCs !== undefined && run.italicCs !== run.italic) ||
    (run.fontSizeCsPt !== undefined && run.fontSizeCsPt !== run.fontSizePt) ||
    Boolean(run.fontHint);
  if (!scriptSensitive || !text.length) {
    return [{text,fontFamily:wordFontFamily(families,"ascii"),script:"ascii",bold:run.bold,italic:run.italic,fontSizePt:run.fontSizePt}];
  }
  const result=[];
  for(const character of text) {
    const script=classifyWordScript(character,run.fontHint);
    const fontFamily=wordFontFamily(families,script);
    const bold=script==="cs" ? (run.boldCs ?? run.bold) : run.bold;
    const italic=script==="cs" ? (run.italicCs ?? run.italic) : run.italic;
    const fontSizePt=script==="cs" ? (run.fontSizeCsPt ?? run.fontSizePt) : run.fontSizePt;
    const last=result[result.length-1];
    if(last && last.fontFamily===fontFamily && last.bold===bold && last.italic===italic && last.fontSizePt===fontSizePt) last.text+=character;
    else result.push({text:character,fontFamily,script,bold,italic,fontSizePt});
  }
  return result;
}
