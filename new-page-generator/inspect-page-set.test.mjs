import test from "node:test";
import assert from "node:assert/strict";
import { inspectPageSet, verifyRenderedInventory, isFloatingDrawingReviewOnly, prepareDocxInspection } from "./inspect-page-set.mjs";
import { FLOATING_DRAWING_REVIEW_ERROR } from "./extract-docx.mjs";

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


test("Markdown inputs normalize through the same inspected HTML inventory",async()=>{
 const parser={parseFromString:()=>({head:{childNodes:[]},body:{childNodes:[{
  nodeType:1,tagName:"H1",attributes:[],childNodes:[{nodeType:3,textContent:"Markdown title"}],
  getAttribute:()=>null
 },{
  nodeType:1,tagName:"P",attributes:[],childNodes:[{nodeType:3,textContent:"Keep 日本語 and 繁體中文"}],
  getAttribute:()=>null
 }]}})};
 const set={pages:Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{
  title:lang,mode:"markdown",source:lang+".md",route:"/"+lang+"/"
 }]))};
 const inputs=Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{
  markdown:"# Markdown title\n\nKeep 日本語 and 繁體中文",parser
 }]));
 const result=await inspectPageSet(set,inputs);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.pages.en.normalizedBlocks[0].sourceMode,"markdown");
 assert.equal(result.pages.en.normalizedBlocks[0].sourceLocation.part,"markdown-source");
});


test("HTML file mode shares the strict inspector while retaining file provenance",async()=>{
 const parser={parseFromString:()=>({head:{childNodes:[]},body:{childNodes:[{nodeType:3,textContent:"HTML file article"}]}})};
 const set={pages:Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{
  title:lang,mode:"html",source:lang+".html",route:"/"+lang+"/"
 }]))};
 const inputs=Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{html:"<p>HTML file article</p>",parser}]));
 const result=await inspectPageSet(set,inputs);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.pages.en.normalizedBlocks[0].sourceMode,"html");
 assert.equal(result.pages.en.normalizedBlocks[0].sourceLocation.part,"html-file");
});


test("identifies only a verified floating-image preview as requiring visual review",()=>{
 const preview={ok:false,errors:[FLOATING_DRAWING_REVIEW_ERROR],previewHtml:"<p>preview</p>",sha256:"a".repeat(64)};
 assert.equal(isFloatingDrawingReviewOnly(preview),true);
 assert.equal(isFloatingDrawingReviewOnly({...preview,errors:[...preview.errors,"other blocker"]}),false);
 assert.equal(isFloatingDrawingReviewOnly({...preview,previewHtml:undefined}),false);
 assert.equal(isFloatingDrawingReviewOnly({...preview,sha256:undefined}),false);
});


test("requires approval bound to the exact source hash for floating-image previews",()=>{
 const paragraph={nodeType:1,tagName:"P",attributes:[],childNodes:[{nodeType:3,textContent:"Preview text"}],getAttribute:()=>null};
 const parser={parseFromString:()=>({head:{childNodes:[]},body:{childNodes:[paragraph]}})};
 const extracted={ok:false,errors:[FLOATING_DRAWING_REVIEW_ERROR],previewHtml:"<p>Preview text</p>",sha256:"a".repeat(64),assetFiles:[{path:"/assets/a.png"}]};
 const pending=prepareDocxInspection(extracted,parser);
 assert.equal(pending.inspected.ok,true,pending.inspected.errors.join("; "));
 assert.equal(pending.visualReviewRequired,true);
 assert.equal(pending.visualReviewApproved,false);
 assert.equal(pending.sourceSha256,extracted.sha256);
 assert.equal(pending.reviewWarnings[0],FLOATING_DRAWING_REVIEW_ERROR);
 const approved=prepareDocxInspection(extracted,parser,extracted.sha256);
 assert.equal(approved.inspected.ok,true,approved.inspected.errors.join("; "));
 assert.equal(approved.visualReviewRequired,false);
 assert.equal(approved.visualReviewApproved,true);
 assert.deepEqual(approved.reviewWarnings,[]);
 assert.deepEqual(approved.assetFiles,extracted.assetFiles);
 const blocked=prepareDocxInspection({...extracted,errors:[FLOATING_DRAWING_REVIEW_ERROR,"other blocker"]},parser,extracted.sha256);
 assert.equal(blocked.visualReviewApproved,false);
 assert.equal(blocked.inspected.ok,false);
});
