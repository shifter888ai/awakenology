// Independent rendered-HTML inventory. Caller inventories are not trusted.
// Only explicit formatting is supported; inherited CSS requires separate review.
const formatting = (node, key) => node.getAttribute?.('style')?.split(';').map(x=>x.trim()).find(x=>x.toLowerCase().startsWith(key+':'))?.split(':').slice(1).join(':').trim() ?? null;
export function inspectRenderedRichContent(html, parser) {
  const errors=[], runs=[], images=[];
  if (typeof html !== 'string' || !parser?.parseFromString) return {ok:false,errors:['HTML and a parser are required.'],runs,images};
  const doc=parser.parseFromString(html,'text/html');
  let paragraphIndex=-1, order=0;
  function visit(node, state) {
    if (node.nodeType===3) {
      if (node.textContent) runs.push({text:node.textContent,...state});
      return;
    }
    if (node.nodeType!==1) return;
    const tag=node.tagName.toUpperCase();
    if (['P','H1','H2','H3','H4','H5','H6','LI','TD','TH','BLOCKQUOTE'].includes(tag)) paragraphIndex++;
    const style=node.getAttribute?.('style') ?? '';
    const allowed=new Set(['color','font-weight','font-style','text-decoration']);
    for(const decl of style.split(';').filter(x=>x.trim())) {
      const index=decl.indexOf(':');
      if(index<0 || !allowed.has(decl.slice(0,index).trim().toLowerCase())) errors.push('Unsupported rendered style: '+decl);
    }
    const next={...state};
    if(['B','STRONG'].includes(tag) || formatting(node,'font-weight')==='bold') next.bold=true;
    if(['I','EM'].includes(tag) || formatting(node,'font-style')==='italic') next.italic=true;
    if(tag==='U' || formatting(node,'text-decoration')==='underline') next.underline=true;
    const color=formatting(node,'color'); if(color!==null) next.color=color;
    if(tag==='A') {const href=node.getAttribute('href'); if(!href) errors.push('Link without href.'); next.href=href;}
    if(tag==='IMG') {
      const assetPath=node.getAttribute('src'), alt=node.getAttribute('alt');
      if(!assetPath || alt===null) errors.push('Image lacks src or alt.');
      images.push({assetPath,paragraphIndex,order:order++,alt});
    }
    for(const child of node.childNodes ?? []) visit(child,next);
  }
  const initial={bold:false,italic:false,underline:false,color:null,href:null};
  for(const child of doc.body?.childNodes ?? []) visit(child,initial);
  if(!runs.length) errors.push('No rendered text runs.');
  return {ok:errors.length===0,errors,runs,images};
}
