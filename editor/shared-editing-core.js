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
   const start=node===range.startContainer?range.startOffset:0;
   const end=node===range.endContainer?range.endOffset:node.length;
   if(end>start)nodes.push({node,start,end});
  }
  if(!nodes.length)throw Error('No text selected.');
  for(const item of nodes.reverse()){
   let target=item.node;
   if(item.end<target.length)target.splitText(item.end);
   if(item.start>0)target=target.splitText(item.start);
   if(size===null){
    let parent=target.parentElement;
    // Only remove font-size from a wrapper when its entire text is selected.
    // Split a partially selected wrapper so unrelated text keeps its formatting.
    if(parent&&parent.tagName==='SPAN'&&parent.style.fontSize){
     if(parent.textContent===target.data){parent.style.removeProperty('font-size');if(!parent.attributes.length)parent.replaceWith(...parent.childNodes);}
     else {const replacement=parent.cloneNode(false);replacement.style.removeProperty('font-size');target.replaceWith(replacement);replacement.append(target);if(!replacement.attributes.length)replacement.replaceWith(target);}
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
