import { parseFragment, serialize } from "parse5";
import { PILOT_LANGUAGE_MARKERS } from "./segment-docx-languages.mjs";

const textContent = node => {
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(textContent).join("");
};
const walk = (node, predicate, found=[]) => {
  if (predicate(node)) found.push(node);
  for (const child of node.childNodes ?? []) walk(child,predicate,found);
  return found;
};
const countTag = (nodes, tag) => nodes.reduce((sum,node)=>sum+walk(node,n=>n.tagName===tag).length,0);

/**
 * Splits an extracted HTML fragment into title-delimited review fragments.
 * This is an inventory helper only; callers must still run independent
 * source/output fidelity checks before using the fragments for generation.
 */
export function segmentConvertedHtml(html, markers = PILOT_LANGUAGE_MARKERS) {
  if (typeof html !== "string" || !html.trim()) return { ok:false,errors:["A nonempty converted HTML fragment is required."],segments:[] };
  const fragment = parseFragment(html);
  const nodes = fragment.childNodes ?? [];
  const errors = [];
  const boundaries = markers.map(item => {
    const found = [];
    nodes.forEach((node,index) => {
      if (textContent(node).includes(item.marker)) found.push({index,node});
    });
    if (found.length !== 1) errors.push(item.language + ": expected exactly one top-level HTML block containing title marker " + JSON.stringify(item.marker) + ", found " + found.length + ".");
    return { language:item.language,marker:item.marker,index:found.length===1?found[0].index:null };
  });
  if (errors.length) return { ok:false,errors,segments:[],boundaries };
  for (let i=1;i<boundaries.length;i++) {
    if (boundaries[i].index<=boundaries[i-1].index) errors.push("Converted HTML title markers are not in expected language order.");
  }
  if (errors.length) return { ok:false,errors,segments:[],boundaries };
  const prefix = nodes.slice(0,boundaries[0].index);
  if (prefix.some(node => textContent(node).trim())) errors.push("Converted HTML contains non-whitespace content before the first language title.");
  if (errors.length) return { ok:false,errors,segments:[],boundaries };
  const segments = boundaries.map((boundary,i) => {
    const end = boundaries[i+1]?.index ?? nodes.length;
    const selected = nodes.slice(boundary.index,end);
    const segmentFragment = { nodeName:"#document-fragment",childNodes:selected };
    return {
      language:boundary.language,marker:boundary.marker,
      startNode:boundary.index,endNodeExclusive:end,
      paragraphCount:countTag(selected,"p"),
      imageCount:countTag(selected,"img"),
      textCharacterCount:selected.reduce((sum,node)=>sum+textContent(node).length,0),
      html:serialize(segmentFragment)
    };
  });
  const originalText = nodes.slice(boundaries[0].index).map(textContent).join("");
  const splitText = segments.map(segment => {
    const part = parseFragment(segment.html);
    return (part.childNodes??[]).map(textContent).join("");
  }).join("");
  if (splitText !== originalText) errors.push("Language HTML split did not preserve exact concatenated text.");
  return { ok:errors.length===0,errors,segments,boundaries };
}
