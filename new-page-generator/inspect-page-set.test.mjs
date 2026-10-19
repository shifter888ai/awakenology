import test from "node:test";
import assert from "node:assert/strict";
import { inspectPageSet, verifyRenderedInventory } from "./inspect-page-set.mjs";

const pageSet = () => ({ pages: Object.fromEntries(["en","ja","zh-Hant"].map((lang, i) => [lang, {
  title: lang, mode: i === 0 ? "docx" : "paste", source: "source-" + lang, route: "/" + lang + "/"
}])) });
test("invalid DOCX is explicitly blocked", async () => {
  const result = await inspectPageSet(pageSet(), {
    en: { buffer: Buffer.from("not a docx") },
    ja: {}, "zh-Hant": {}
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Invalid or corrupt DOCX ZIP package/);
});
test("missing input is blocking", async () => {
  const result = await inspectPageSet(pageSet(), {});
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /input payload missing/);
});
test("failed source cannot pass output comparison", () => {
  assert.equal(verifyRenderedInventory({ inventory: [], errors: ["unsafe"] }, []).ok, false);
});
test("identical inspected and rendered inventories pass", () => {
  const inventory = [{ type: "text", path: "/0", value: "中文 日本語 English" }];
  assert.equal(verifyRenderedInventory({ inventory, errors: [] }, structuredClone(inventory)).ok, true);
});

test("successful paste inspection also returns normalized blocks", async () => {
  const textNode = { nodeType: 3, textContent: "Preserve 日本語 中文 English" };
  const parser = { parseFromString: () => ({ body: { childNodes: [textNode] } }) };
  const set = { pages: Object.fromEntries(["en", "ja", "zh-Hant"].map(lang => [lang, {
    title: lang, mode: "paste", source: "source-" + lang, route: "/" + lang + "/"
  }])) };
  const inputs = Object.fromEntries(["en", "ja", "zh-Hant"].map(lang => [lang, { html: "<p>source</p>", parser }]));
  const result = await inspectPageSet(set, inputs);
  assert.equal(result.ok, true, result.errors.join("; "));
  for (const lang of ["en", "ja", "zh-Hant"]) {
    assert.equal(result.pages[lang].normalizedBlocks[0].text, "Preserve 日本語 中文 English");
    assert.equal(result.pages[lang].normalizedBlocks[0].language, lang);
    assert.equal(result.pages[lang].normalizedBlocks[0].sourceLocation.part, "pasted-html");
  }
});


test("blocks CSS hidden in the head of pasted HTML",async()=>{
 const textNode={nodeType:3,textContent:"Article text"};
 const styleNode={nodeType:1,tagName:"STYLE",childNodes:[],getAttribute:()=>null};
 const parser={parseFromString:()=>({head:{childNodes:[styleNode]},body:{childNodes:[textNode]}})};
 const set={pages:Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{
  title:lang,mode:"paste",source:"source-"+lang,route:"/"+lang+"/"
 }]))};
 const inputs=Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{html:"<html><head><style>p{color:red}</style></head><body><p>Article text</p></body></html>",parser}]));
 const result=await inspectPageSet(set,inputs);
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes("Embedded CSS in the HTML head")));
});


test("rejects scripts in the raw HTML head even if the parser omits them from body",async()=>{
 const textNode={nodeType:3,textContent:"Article text"};
 const parser={parseFromString:()=>({head:{childNodes:[]},body:{childNodes:[textNode]}})};
 const set={pages:Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{
  title:lang,mode:"paste",source:"source-"+lang,route:"/"+lang+"/"
 }]))};
 const inputs=Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{html:"<html><head><script>run()</script></head><body><p>Article text</p></body></html>",parser}]));
 const result=await inspectPageSet(set,inputs);
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes("Raw HTML contains unsupported element <script>")));
 assert.ok(result.errors.some(x=>x.includes("Raw HTML contains unsupported element <html>")));
});
