// Independent rendered-HTML inventory. Caller inventories are not trusted.
// Only explicit formatting is supported; inherited CSS requires separate review.
const formatting = (node, key) => node.getAttribute?.('style')?.split(';').map(x=>x.trim()).find(x=>x.toLowerCase().startsWith(key+':'))?.split(':').slice(1).join(':').trim() ?? null;
export function inspectRenderedRichContent(html, parser) {
  const errors=[], runs=[], images=[], lineBreaks=[], paragraphLayouts=[];
  const paragraphOffsets = new Map();
  const fontSizePt = node => {
    const value = formatting(node,'font-size');
    if (value === null) return null;
    const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(value.toLowerCase());
    if (!match || Number(match[1]) <= 0) { errors.push('Unsupported rendered font-size: ' + value); return null; }
    return Number(match[1]) * (match[2] === 'px' ? 0.75 : 1);
  };
  const paragraphMarkerOrders = new Map();
  const nextMarkerOrder = index => { const value=paragraphMarkerOrders.get(index) ?? 0; paragraphMarkerOrders.set(index,value+1); return value; };
  if (typeof html !== 'string' || !parser?.parseFromString) return {ok:false,errors:['HTML and a parser are required.'],runs,images,lineBreaks,paragraphLayouts,paragraphCount:0};
  const doc=parser.parseFromString(html,'text/html');
  let paragraphIndex=-1, order=0;
  const inspectHead = node => {
    if (node?.nodeType === 1) {
      const tag = node.tagName.toUpperCase();
      if (tag === 'STYLE') errors.push('Embedded CSS rules are unsupported in rendered rich-content inspection.');
      if (tag === 'LINK' && /stylesheet/i.test(node.getAttribute?.('rel') ?? '')) errors.push('External stylesheets are unsupported in rendered rich-content inspection.');
      for (const child of node.childNodes ?? []) inspectHead(child);
    }
  };
  for (const child of doc.head?.childNodes ?? []) inspectHead(child);
  function visit(node, state) {
    if (node.nodeType===3) {
      if (node.textContent) {
        if (paragraphIndex < 0) errors.push('Rendered text occurs outside a recognized paragraph block.');
        runs.push({paragraphIndex:Math.max(0,paragraphIndex),text:node.textContent,...state});
        if (paragraphIndex >= 0) paragraphOffsets.set(paragraphIndex,(paragraphOffsets.get(paragraphIndex) ?? 0)+node.textContent.length);
      }
      return;
    }
    if (node.nodeType!==1) return;
    const tag=node.tagName.toUpperCase();
    if (['H1','H2','H3','H4','H5','H6','BLOCKQUOTE','UL','OL','LI','TABLE','THEAD','TBODY','TFOOT','TR','TD','TH','HR','PRE','CODE','SUP','SUB','FONT','MARK','SMALL','BIG'].includes(tag)) {
      errors.push('Unsupported rendered structural/semantic formatting tag: ' + tag + '.');
    }
    if (tag === 'STYLE') errors.push('Embedded CSS rules are unsupported in rendered rich-content inspection.');
    if (tag === 'LINK' && /stylesheet/i.test(node.getAttribute?.('rel') ?? '')) errors.push('External stylesheets are unsupported in rendered rich-content inspection.');
    if (['P','H1','H2','H3','H4','H5','H6','LI','TD','TH','BLOCKQUOTE'].includes(tag)) {
      paragraphIndex++;
      paragraphOffsets.set(paragraphIndex,0);
      paragraphMarkerOrders.set(paragraphIndex,0);
      const alignmentValue = formatting(node,'text-align');
      const alignMap = {left:'left',right:'right',center:'center',justify:'both',start:'start',end:'end'};
      let alignment = 'left';
      if (alignmentValue !== null) {
        if (!Object.hasOwn(alignMap,alignmentValue.toLowerCase())) errors.push('Unsupported rendered paragraph alignment: '+alignmentValue);
        else alignment = alignMap[alignmentValue.toLowerCase()];
      }
      const readTwips = (key) => {
        const value = formatting(node,key);
        if (value === null) return 0;
        const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(value.toLowerCase());
        if (!match) { errors.push('Unsupported rendered paragraph '+key+': '+value); return 0; }
        return Number(match[1]) * (match[2] === 'px' ? 15 : 20);
      };
      const indentation = {left:readTwips('margin-left'),right:readTwips('margin-right')};
      const firstLine = formatting(node,'text-indent');
      if (firstLine !== null) {
        const match = /^(-?\d+(?:\.\d+)?)(pt|px)$/.exec(firstLine.toLowerCase());
        if (!match) errors.push('Unsupported rendered paragraph text-indent: '+firstLine);
        else {
          const twips = Number(match[1]) * (match[2] === 'px' ? 15 : 20);
          if (twips < 0) indentation.hanging = -twips;
          else if (twips > 0) indentation.firstLine = twips;
        }
      }
      const readPoints = key => {
        const value = formatting(node,key);
        if (value === null) return 0;
        if (value === '0') return 0;
        const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(value.toLowerCase());
        if (!match) { errors.push('Unsupported rendered paragraph '+key+': '+value); return 0; }
        return Number(match[1]) * (match[2] === 'px' ? 0.75 : 1);
      };
      const rawLineHeight = formatting(node,'line-height');
      let lineHeightPt = null;
      if (rawLineHeight !== null) {
        const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(rawLineHeight.toLowerCase());
        if (!match) errors.push('Unsupported rendered paragraph line-height: '+rawLineHeight);
        else lineHeightPt = Number(match[1]) * (match[2] === 'px' ? 0.75 : 1);
      }
      const spacing = {beforePt:readPoints('margin-top'),afterPt:readPoints('margin-bottom'),lineHeightPt};
      paragraphLayouts.push({paragraphIndex,alignment,indentation,spacing});
    }
    if (tag === 'BR') lineBreaks.push({paragraphIndex:Math.max(0,paragraphIndex),textOffset:paragraphOffsets.get(paragraphIndex) ?? 0,breakType:'textWrapping',markerOrder:nextMarkerOrder(Math.max(0,paragraphIndex))});
    const style=node.getAttribute?.('style') ?? '';
    const allowed=new Set(['color','font-weight','font-style','text-decoration','font-size','text-align','margin-left','margin-right','text-indent','margin-top','margin-bottom','line-height','font-family','text-transform','letter-spacing','font-kerning']);
    for(const decl of style.split(';').filter(x=>x.trim())) {
      const index=decl.indexOf(':');
      if(index<0 || !allowed.has(decl.slice(0,index).trim().toLowerCase())) errors.push('Unsupported rendered style: '+decl);
    }
    const weight=formatting(node,'font-weight'), fontStyle=formatting(node,'font-style'), decoration=formatting(node,'text-decoration');
    if(weight!==null && !['bold','normal','400','700'].includes(weight.toLowerCase())) errors.push('Unsupported rendered font-weight: '+weight);
    if(fontStyle!==null && !['italic','normal'].includes(fontStyle.toLowerCase())) errors.push('Unsupported rendered font-style: '+fontStyle);
    if(decoration!==null && !['underline','none'].includes(decoration.toLowerCase())) errors.push('Unsupported rendered text-decoration: '+decoration);
    const transform=formatting(node,'text-transform');
    if(transform!==null && !['uppercase','none'].includes(transform.toLowerCase())) errors.push('Unsupported rendered text-transform: '+transform);
    const family=formatting(node,'font-family');
    const letterSpacing=formatting(node,'letter-spacing');
    const fontKerning=formatting(node,'font-kerning');
    if(['S','STRIKE','DEL'].includes(tag)) errors.push('Unsupported rendered deletion/strike formatting: '+tag);
    const next={...state};
    const size=fontSizePt(node); if(size!==null) {next.fontSizePt=size;next.fontSizeCsPt=size;}
    const fontFamilies={};
    for(const [attr,key] of [['data-word-font-ascii','ascii'],['data-word-font-hansi','hAnsi'],['data-word-font-east-asia','eastAsia'],['data-word-font-cs','cs']]) {const value=node.getAttribute?.(attr);if(value)fontFamilies[key]=value;}
    if(node.getAttribute?.('data-word-font-hint')) next.fontHint=node.getAttribute('data-word-font-hint');
    if(Object.keys(fontFamilies).length) next.fontFamily=fontFamilies;
    else if(family!==null) next.fontFamily=family.replace(/^['"]|['"]$/g,'');
    const language={};
    for(const [attr,key] of [['data-word-lang-val','val'],['data-word-lang-east-asia','eastAsia'],['data-word-lang-bidi','bidi']]) {const value=node.getAttribute?.(attr);if(value)language[key]=value;}
    if(Object.keys(language).length) next.language=language;
    else if(node.getAttribute?.('lang')) next.language={val:node.getAttribute('lang')};
    if(transform!==null) next.allCaps=transform.toLowerCase()==='uppercase';
    if(fontKerning!==null) {if(!['normal','none','auto'].includes(fontKerning.toLowerCase())) errors.push('Unsupported rendered font-kerning: '+fontKerning);else next.fontKerning=fontKerning.toLowerCase();}
    if(letterSpacing!==null) {
      const match=/^(-?\d+(?:\.\d+)?)(pt|px)$/.exec(letterSpacing.toLowerCase());
      if(letterSpacing==='0') next.letterSpacingPt=0;
      else if(!match) errors.push('Unsupported rendered letter-spacing: '+letterSpacing);
      else next.letterSpacingPt=Number(match[1])*(match[2]==='px'?0.75:1);
    }
    if(weight!==null) next.bold=['bold','700'].includes(weight.toLowerCase());
    else if(['B','STRONG'].includes(tag)) next.bold=true;
    if(fontStyle!==null) next.italic=fontStyle.toLowerCase()==='italic';
    else if(['I','EM'].includes(tag)) next.italic=true;
    if(decoration!==null) next.underline=decoration.toLowerCase()==='underline';
    else if(tag==='U') next.underline=true;
    const color=formatting(node,'color'); if(color!==null) next.color=color;
    if(tag==='A') {const href=node.getAttribute('href'); if(!href) errors.push('Link without href.'); next.href=href;}
    if(tag==='IMG') {
      const assetPath=node.getAttribute('src'), alt=node.getAttribute('alt');
      if(!assetPath || alt===null) errors.push('Image lacks src or alt.');
      images.push({assetPath,paragraphIndex,order:order++,alt,textOffset:paragraphOffsets.get(paragraphIndex) ?? 0,markerOrder:nextMarkerOrder(Math.max(0,paragraphIndex)),placement:{kind:'inline'}});
    }
    for(const child of node.childNodes ?? []) visit(child,next);
  }
  const initial={bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null,fontKerning:null,fontHint:null};
  for(const child of doc.body?.childNodes ?? []) visit(child,initial);
  if(!runs.length) errors.push('No rendered text runs.');
  return {ok:errors.length===0,errors,runs,images,lineBreaks,paragraphLayouts,paragraphCount:paragraphIndex+1};
}
