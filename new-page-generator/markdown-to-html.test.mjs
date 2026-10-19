import test from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "./markdown-to-html.mjs";

test("converts common Markdown structure and preserves CJK text",()=>{
 const result=markdownToHtml("# Heading\n\nA **bold** and *italic* paragraph with 日本語 and 繁體中文.\n\n1. First\n2. Second\n\n- Bullet A\n- Bullet B");
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<h1>Heading<\/h1>/);
 assert.match(result.html,/<strong>bold<\/strong>/);
 assert.match(result.html,/<em>italic<\/em>/);
 assert.match(result.html,/<ol><li>First<\/li><li>Second<\/li><\/ol>/);
 assert.match(result.html,/<ul><li>Bullet A<\/li><li>Bullet B<\/li><\/ul>/);
 assert.match(result.html,/日本語 and 繁體中文/);
});

test("escapes raw HTML and fails closed instead of passing it through",()=>{
 const result=markdownToHtml("Text <script>alert(1)</script>");
 assert.equal(result.ok,false);
 assert.match(result.errors.join(" "),/raw HTML is unsupported/);
 assert.equal(result.html,"");
});

test("blocks unsafe links and images",()=>{
 for(const source of ["[click](javascript:alert(1))","![x](data:image/png;base64,AA==)","[x](//example.com)"]){
  const result=markdownToHtml(source);
  assert.equal(result.ok,false,source);
  assert.match(result.errors.join(" "),/unsafe or unsupported/);
 }
});

test("preserves non-default ordered list starts",()=>{
 const result=markdownToHtml("4. Fourth\n5. Fifth");
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<ol start="4"><li>Fourth<\/li><li>Fifth<\/li><\/ol>/);
});

test("rejects unsupported tables, task lists, and fenced code rather than silently flattening them",()=>{
 for(const source of ["| A | B |\n|---|---|\n| 1 | 2 |","- [ ] task","\u0060\u0060\u0060js\nalert(1)\n\u0060\u0060\u0060"]){
  const result=markdownToHtml(source);
  assert.equal(result.ok,false,source);
 }
});

test("empty and NUL-containing sources are blocked",()=>{
 assert.equal(markdownToHtml("  ").ok,false);
 assert.equal(markdownToHtml("a\u0000b").ok,false);
});


test("preserves inline code as escaped code content",()=>{
 const result=markdownToHtml("Use `<tag>&value` literally.");
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<code>&lt;tag&gt;&amp;value<\/code>/);
});


test("preserves inline emphasis inside Markdown link labels",()=>{
 const result=markdownToHtml("[**bold link**](https://example.org)");
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<a href="https:\/\/example\.org"><strong>bold link<\/strong><\/a>/);
});
