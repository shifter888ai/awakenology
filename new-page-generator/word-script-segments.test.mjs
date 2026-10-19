import test from "node:test";
import assert from "node:assert/strict";
import { splitWordScriptSegments } from "./word-script-segments.mjs";

test("splits mixed Latin and CJK text where Word assigns different script fonts", () => {
 const segments=splitWordScriptSegments("ABC日本語",{
  fontFamily:{ascii:"Arial",hAnsi:"Arial",eastAsia:"MS Mincho",cs:"Arial"},
  bold:false,italic:false
 });
 assert.deepEqual(segments.map(x=>({text:x.text,fontFamily:x.fontFamily,script:x.script})),[
  {text:"ABC",fontFamily:"Arial",script:"ascii"},
  {text:"日本語",fontFamily:"MS Mincho",script:"eastAsia"}
 ]);
});
test("applies complex-script emphasis without changing Latin emphasis", () => {
 const segments=splitWordScriptSegments("abc العربية xyz",{bold:false,italic:false,boldCs:true,italicCs:true});
 assert.deepEqual(segments.map(x=>({text:x.text,bold:x.bold,italic:x.italic})),[
  {text:"abc ",bold:false,italic:false},
  {text:"العربية",bold:true,italic:true},
  {text:" xyz",bold:false,italic:false}
 ]);
});
test("uses Word font hint for ambiguous punctuation", () => {
 const segments=splitWordScriptSegments("A，B",{fontFamily:{ascii:"Arial",eastAsia:"MS Mincho"},fontHint:"eastAsia"});
 assert.deepEqual(segments.map(x=>({text:x.text,fontFamily:x.fontFamily})),[
  {text:"A",fontFamily:"Arial"},
  {text:"，",fontFamily:"MS Mincho"},
  {text:"B",fontFamily:"Arial"}
 ]);
});
