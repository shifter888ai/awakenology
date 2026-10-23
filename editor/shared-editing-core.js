/* Shared selection formatting for Awakenology Generator and Editor.
 * Operates on text nodes, never wraps block elements in a span.
 */
(function(root){
 'use strict';
 function applyFontSize(doc, selection, value, article){
  if(!doc||!selection||!selection.rangeCount||selection.isCollapsed||!article)throw Error('Select article text first.');
  const range=selection.getRangeAt(0);
  if(!article.contains(range.commonAncestorContainer))throw Error('Selection must remain inside the article.');
  const size=value===''?null:Number(value);
  if(size!==null&&(!Number.isFinite(size)||size<=0||size>200))throw Error('Invalid font size.');
  const nodes=[];
  const walker=doc.createTreeWalker(article,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(!node.data.length||!range.intersectsNode(node))continue;
   // Derive offsets by comparing boundary points, including selections whose
   // endpoints are element nodes (e.g. across paragraphs).
   const probe=doc.createRange();
   probe.selectNodeContents(node);
   let start=0,end=node.length;
   const overlap=doc.createRange();
   overlap.selectNodeContents(node);
   if(range.compareBoundaryPoints(range.START_TO_START,overlap)>0)overlap.setStart(range.startContainer,range.startOffset);
   if(range.compareBoundaryPoints(range.END_TO_END,overlap)<0)overlap.setEnd(range.endContainer,range.endOffset);
   const prefix=doc.createRange();prefix.setStart(node,0);prefix.setEnd(overlap.startContainer,overlap.startOffset);
   start=prefix.toString().length;
   end=start+overlap.toString().length;
   if(end>start)nodes.push({node,start,end});
  }
  if(!nodes.length)throw Error('No text selected.');
  // Refuse unsupported nested font-size resets before mutating any content.
  if(size===null&&nodes.some(({node})=>{let p=node.parentElement, count=0;while(p&&p!==article){if(p.style?.fontSize)count++;p=p.parentElement;}return count>1;}))throw Error('Nested font-size formatting needs manual review; no changes made.');
  for(const item of nodes.reverse()){
   let target=item.node;
   if(item.end<target.length)target.splitText(item.end);
   if(item.start>0)target=target.splitText(item.start);
   if(size===null){
    const parent=target.parentElement;
    if(parent&&parent.tagName==='SPAN'&&parent.style.fontSize){
     // Move the selected text outside its styled wrapper. Preserve the
     // unselected suffix in a clone, including other inline attributes.
     const suffix=parent.cloneNode(false);
     while(target.nextSibling)suffix.append(target.nextSibling);
     parent.after(target);
     if(suffix.hasChildNodes())target.after(suffix);
     if(!parent.hasChildNodes())parent.remove();
    }

   }else{
    const span=doc.createElement('span');span.style.fontSize=size+'pt';target.replaceWith(span);span.append(target);
   }
  }
  selection.removeAllRanges();
  return nodes.length;
 }
 root.AwakenologyEditingCore=Object.freeze({applyFontSize});
})(window);
