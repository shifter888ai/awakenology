import { parseFragment, serialize } from "parse5";
import { splitWordScriptSegments } from "./word-script-segments.mjs";

const ESCAPE = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const CSS_QUOTE = value => '"' + String(value).replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/[\r\n]/g," ") + '"';
const twipsPt = value => Number(value ?? 0) / 20;
const textNodes = node => {
  const result = [];
  const visit = current => {
    if (current.nodeName === "#text") { result.push(current); return; }
    for (const child of current.childNodes ?? []) visit(child);
  };
  visit(node);
  return result;
};
const nodeText = node => textNodes(node).map(item => item.value).join("");
const attr = (node,name) => node.attrs?.find(item=>item.name===name)?.value ?? null;
const setAttr = (node,name,value) => {
  node.attrs ??= [];
  const found=node.attrs.find(item=>item.name===name);
  if(found) found.value=value; else node.attrs.push({name,value});
};
const formattingStyle = (run, fontFamily = null) => {
  const declarations = [
    "font-weight:"+(run.bold?"bold":"normal"),
    "font-style:"+(run.italic?"italic":"normal"),
    "text-decoration:"+(run.underline?"underline":"none"),
    "text-transform:"+(run.allCaps?"uppercase":"none")
  ];
  if(run.color) declarations.push("color:"+run.color);
  if(run.fontSizePt !== null && run.fontSizePt !== undefined) declarations.push("font-size:"+run.fontSizePt+"pt");
  if(fontFamily || typeof run.fontFamily === "string") declarations.push("font-family:"+CSS_QUOTE(fontFamily || run.fontFamily));
  if(run.letterSpacingPt !== null && run.letterSpacingPt !== undefined) declarations.push("letter-spacing:"+run.letterSpacingPt+"pt");
  if(run.fontKerning) declarations.push("font-kerning:"+run.fontKerning);
  return declarations.join(";");
};
function paragraphStyle(layout) {
  const css = [];
  const alignment = {left:"left",right:"right",center:"center",both:"justify",start:"start",end:"end",distribute:"justify"};
  if (!alignment[layout.alignment]) throw new Error("Unsupported resolved paragraph alignment.");
  if(layout.alignment!=="left") css.push("text-align:"+alignment[layout.alignment]);
  const indent=layout.indentation ?? {};
  for (const [key,cssKey] of [["left","margin-left"],["right","margin-right"]]) {
    if (indent[key] !== undefined && Number(indent[key])!==0) css.push(cssKey+":"+twipsPt(indent[key])+"pt");
  }
  if (indent.firstLine !== undefined && Number(indent.firstLine)!==0) css.push("text-indent:"+twipsPt(indent.firstLine)+"pt");
  if (indent.hanging !== undefined && Number(indent.hanging)!==0) css.push("text-indent:-"+twipsPt(indent.hanging)+"pt");
  const spacing=layout.spacing ?? {};
  if (spacing.beforePt !== undefined && Number(spacing.beforePt)!==0) css.push("margin-top:"+spacing.beforePt+"pt");
  if (spacing.afterPt !== undefined && Number(spacing.afterPt)!==0) css.push("margin-bottom:"+spacing.afterPt+"pt");
  if (spacing.lineHeightPt !== null && spacing.lineHeightPt !== undefined) css.push("line-height:"+spacing.lineHeightPt+"pt");
  if (spacing.lineHeight !== null && spacing.lineHeight !== undefined) css.push("line-height:"+spacing.lineHeight);
  return css.join(";");
}
const needsSpan = run => Boolean(run.bold || run.italic || run.underline || run.color || run.fontFamily ||
  run.language || run.allCaps || run.fontSizePt !== null && run.fontSizePt !== undefined || run.fontSizeCsPt !== null && run.fontSizeCsPt !== undefined ||
  run.letterSpacingPt !== null && run.letterSpacingPt !== undefined || run.fontKerning || run.fontHint || run.boldCs !== undefined || run.italicCs !== undefined);

export function applyDocxRichFormatting(html, sourceInventory) {
  const errors=[];
  if (typeof html!=="string" || !sourceInventory || !Array.isArray(sourceInventory.runs) || !Array.isArray(sourceInventory.paragraphLayouts) || !Number.isInteger(sourceInventory.paragraphCount)) {
    return {ok:false,errors:["Rendered HTML and a complete source rich-content inventory are required."],html:null};
  }
  const fragment=parseFragment(html);
  const blocks=[];
  const walk=(node, insideListItem=false)=>{
    if (node.nodeName === "p" || node.nodeName === "li") {
      if (insideListItem) {
        errors.push("Nested list content inside a list item requires explicit paragraph-boundary mapping.");
        return;
      }
      blocks.push(node);
      const nested = node.childNodes?.some(child => child.nodeName === "ol" || child.nodeName === "ul");
      if (nested) errors.push("Nested lists require explicit source-to-rendered paragraph mapping.");
      return;
    }
    if (["h1","h2","h3","h4","h5","h6","td","th","blockquote"].includes(node.nodeName)) {
      errors.push("Unsupported rendered paragraph container <"+node.nodeName+"> for source formatting alignment.");
    }
    for(const child of node.childNodes??[]) walk(child, insideListItem || node.nodeName === "li");
  };
  walk(fragment);
  if(blocks.length!==sourceInventory.paragraphCount) errors.push("Rendered paragraph count "+blocks.length+" differs from source count "+sourceInventory.paragraphCount+".");
  const runsByParagraph=Array.from({length:sourceInventory.paragraphCount},()=>[]);
  for(const run of sourceInventory.runs) {
    if(!Number.isInteger(run.paragraphIndex)||run.paragraphIndex<0||run.paragraphIndex>=runsByParagraph.length) {errors.push("Source run has an invalid paragraph index.");continue;}
    runsByParagraph[run.paragraphIndex].push(run);
  }
  for(let p=0;p<Math.min(blocks.length,sourceInventory.paragraphCount);p++) {
    const block=blocks[p], expected=runsByParagraph[p].map(run=>run.text).join(""), actual=nodeText(block);
    if(actual!==expected) {errors.push("Paragraph "+(p+1)+" text differs between source runs and converted HTML.");continue;}
    const layout=sourceInventory.paragraphLayouts.find(item=>item.paragraphIndex===p);
    if(!layout) {errors.push("Missing source paragraph layout for paragraph "+(p+1)+".");continue;}
    const existingStyle=attr(block,"style");
    const numberingForBlock = block.nodeName === "li" ? sourceInventory.paragraphNumbering?.find(item => item.paragraphIndex === p) : null;
    const numberIndent = numberingForBlock?.indentation ?? {};
    const directIndent = layout.indentation ?? {};
    const effectiveLayout = block.nodeName === "li" && numberingForBlock ? {
      ...layout,
      indentation: Object.fromEntries(["left","right","firstLine","hanging"].flatMap(key => {
        const direct = directIndent[key];
        const resolved = direct !== undefined && Number(direct) !== 0 ? direct : numberIndent[key];
        return resolved === undefined || resolved === null || Number(resolved) === 0 ? [] : [[key,resolved]];
      }))
    } : layout;
    const mappedStyle=paragraphStyle(effectiveLayout);
    if(existingStyle || mappedStyle) setAttr(block,"style",[existingStyle,mappedStyle].filter(Boolean).join(";"));
    if (block.nodeName === "li") {
      const numbering = numberingForBlock;
      if (!numbering) {
        errors.push("Rendered list item at paragraph "+(p+1)+" has no corresponding source numbering definition.");
      } else {
        const listTag = block.parentNode?.nodeName;
        const expectedTag = numbering.format === "bullet" ? "ul" : numbering.format === "none" ? null : "ol";
        if (expectedTag && listTag !== expectedTag) errors.push("Rendered list type at paragraph "+(p+1)+" does not match Word numbering format "+numbering.format+".");
        for (const [key,name] of [["numId","data-word-num-id"],["abstractNumId","data-word-abstract-num-id"],["level","data-word-level"],["format","data-word-num-format"],["text","data-word-num-text"],["start","data-word-num-start"]]) {
          if (numbering[key] !== undefined && numbering[key] !== null) setAttr(block,name,String(numbering[key]));
        }
        for (const [key,name] of [["left","data-word-indent-left"],["right","data-word-indent-right"],["firstLine","data-word-indent-first-line"],["hanging","data-word-indent-hanging"]]) {
          if (numbering.indentation?.[key] !== undefined && numbering.indentation[key] !== null) setAttr(block,name,String(numbering.indentation[key]));
        }
      }
    } else if (sourceInventory.paragraphNumbering?.some(item => item.paragraphIndex === p)) {
      errors.push("Source paragraph "+(p+1)+" is numbered but the rendered HTML does not use a list item.");
    }
    // Paragraph-mark properties are not run properties: preserve them as
    // explicit metadata instead of incorrectly applying them to every text run.
    const mark=sourceInventory.paragraphMarkFormatting?.find(item=>item.paragraphIndex===p);
    if(mark) {
      if(mark.fontFamily && typeof mark.fontFamily==="object") {
        for(const [key,name] of [["ascii","data-word-mark-font-ascii"],["hAnsi","data-word-mark-font-hansi"],["eastAsia","data-word-mark-font-east-asia"],["cs","data-word-mark-font-cs"]]) {
          if(mark.fontFamily[key]) setAttr(block,name,mark.fontFamily[key]);
        }
      }
      if(mark.language && typeof mark.language==="object") {
        for(const [key,name] of [["val","data-word-mark-lang-val"],["eastAsia","data-word-mark-lang-east-asia"],["bidi","data-word-mark-lang-bidi"]]) {
          if(mark.language[key]) setAttr(block,name,mark.language[key]);
        }
      }
    }
    const sourceRuns=runsByParagraph[p];
    const spans=[];
    let offset=0;
    for(const run of sourceRuns) {
      const start=offset; offset+=run.text.length;
      spans.push({start,end:offset,run});
    }
    let cursor=0;
    const originalNodes=textNodes(block);
    for(const textNode of originalNodes) {
      const value=textNode.value, start=cursor, end=start+value.length; cursor=end;
      const pieces=[];
      let at=start;
      while(at<end) {
        const runSpan=spans.find(item=>at>=item.start && at<item.end);
        if(!runSpan) {errors.push("No source formatting run covers paragraph "+(p+1)+" text offset "+at+".");break;}
        const stop=Math.min(end,runSpan.end);
        const content=value.slice(at-start,stop-start);
        for(const scriptPart of splitWordScriptSegments(content,runSpan.run)) {
          if(!needsSpan(runSpan.run)) {
            pieces.push({nodeName:"#text",value:scriptPart.text,parentNode:null});
          } else {
            const span={nodeName:"span",tagName:"span",attrs:[{name:"style",value:formattingStyle(runSpan.run,scriptPart.fontFamily)}],namespaceURI:"http://www.w3.org/1999/xhtml",childNodes:[{nodeName:"#text",value:scriptPart.text,parentNode:null}],parentNode:null};
            if(runSpan.run.language && typeof runSpan.run.language==="object") {
              for(const [key,name] of [["val","data-word-lang-val"],["eastAsia","data-word-lang-east-asia"],["bidi","data-word-lang-bidi"]]) if(runSpan.run.language[key]) span.attrs.push({name,value:runSpan.run.language[key]});
              if(runSpan.run.language.val) span.attrs.push({name:"lang",value:runSpan.run.language.val});
            }
            if(runSpan.run.fontHint) span.attrs.push({name:"data-word-font-hint",value:runSpan.run.fontHint});
            if(runSpan.run.fontSizeCsPt !== null && runSpan.run.fontSizeCsPt !== undefined && runSpan.run.fontSizeCsPt !== runSpan.run.fontSizePt) span.attrs.push({name:"data-word-font-size-cs",value:String(runSpan.run.fontSizeCsPt)});
            if(runSpan.run.boldCs !== undefined) span.attrs.push({name:"data-word-bold-cs",value:String(runSpan.run.boldCs)});
            if(runSpan.run.italicCs !== undefined) span.attrs.push({name:"data-word-italic-cs",value:String(runSpan.run.italicCs)});
            if(runSpan.run.fontFamily && typeof runSpan.run.fontFamily==="object") {
              for(const [key,name] of [["ascii","data-word-font-ascii"],["hAnsi","data-word-font-hansi"],["eastAsia","data-word-font-east-asia"],["cs","data-word-font-cs"]]) if(runSpan.run.fontFamily[key]) span.attrs.push({name,value:runSpan.run.fontFamily[key]});
            }
            span.childNodes[0].parentNode=span;
            pieces.push(span);
          }
        }
        at=stop;
      }
      const parent=textNode.parentNode;
      if(!parent) {errors.push("Unable to replace a text node during formatting.");continue;}
      const index=parent.childNodes.indexOf(textNode);
      if(index<0) {errors.push("Text node parent relationship is inconsistent.");continue;}
      for(const piece of pieces) piece.parentNode=parent;
      parent.childNodes.splice(index,1,...pieces);
    }
  }
  if(errors.length) return {ok:false,errors:[...new Set(errors)],html:null};
  return {ok:true,errors:[],html:serialize(fragment)};
}
