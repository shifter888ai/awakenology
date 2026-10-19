import { parseFragment, serialize } from "parse5";

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
const formattingStyle = run => {
  const declarations = [
    "font-weight:"+(run.bold?"bold":"normal"),
    "font-style:"+(run.italic?"italic":"normal"),
    "text-decoration:"+(run.underline?"underline":"none"),
    "text-transform:"+(run.allCaps?"uppercase":"none")
  ];
  if(run.color) declarations.push("color:"+run.color);
  if(run.fontSizePt !== null && run.fontSizePt !== undefined) declarations.push("font-size:"+run.fontSizePt+"pt");
  if(run.fontFamily) declarations.push("font-family:"+CSS_QUOTE(run.fontFamily));
  if(run.letterSpacingPt !== null && run.letterSpacingPt !== undefined) declarations.push("letter-spacing:"+run.letterSpacingPt+"pt");
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
  return css.join(";");
}
const needsSpan = run => Boolean(run.bold || run.italic || run.underline || run.color || run.fontFamily ||
  run.language || run.allCaps || run.fontSizePt !== null && run.fontSizePt !== undefined ||
  run.letterSpacingPt !== null && run.letterSpacingPt !== undefined);
export function applyDocxRichFormatting(html, sourceInventory) {
  const errors=[];
  if (typeof html!=="string" || !sourceInventory || !Array.isArray(sourceInventory.runs) || !Array.isArray(sourceInventory.paragraphLayouts) || !Number.isInteger(sourceInventory.paragraphCount)) {
    return {ok:false,errors:["Rendered HTML and a complete source rich-content inventory are required."],html:null};
  }
  const fragment=parseFragment(html);
  const blocks=[];
  const walk=node=>{
    if (node.nodeName === "p") { blocks.push(node); return; }
    if (["h1","h2","h3","h4","h5","h6","li","td","th","blockquote"].includes(node.nodeName)) {
      errors.push("Unsupported rendered paragraph container <"+node.nodeName+"> for source formatting alignment.");
    }
    for(const child of node.childNodes??[]) walk(child);
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
    const mappedStyle=paragraphStyle(layout);
    if(existingStyle || mappedStyle) setAttr(block,"style",[existingStyle,mappedStyle].filter(Boolean).join(";"));
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
        if(!needsSpan(runSpan.run)) {
          pieces.push({nodeName:"#text",value:content,parentNode:null});
        } else {
          const span={nodeName:"span",tagName:"span",attrs:[{name:"style",value:formattingStyle(runSpan.run)}],namespaceURI:"http://www.w3.org/1999/xhtml",childNodes:[{nodeName:"#text",value:content,parentNode:null}],parentNode:null};
          if(runSpan.run.language && typeof runSpan.run.language==="object") {
            for(const [key,name] of [["val","data-word-lang-val"],["eastAsia","data-word-lang-east-asia"],["bidi","data-word-lang-bidi"]]) if(runSpan.run.language[key]) span.attrs.push({name,value:runSpan.run.language[key]});
            if(runSpan.run.language.val) span.attrs.push({name:"lang",value:runSpan.run.language.val});
          }
          span.childNodes[0].parentNode=span;
          pieces.push(span);
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
