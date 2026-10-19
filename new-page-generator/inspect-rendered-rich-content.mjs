import { resolveDocxFloatingLayout } from "./resolve-docx-floating-layout.mjs";
// Independent rendered-HTML inventory. Caller inventories are not trusted.
// Only explicit formatting is supported; inherited CSS requires separate review.
const formatting = (node, key) => node.getAttribute?.('style')?.split(';').map(x=>x.trim()).find(x=>x.toLowerCase().startsWith(key+':'))?.split(':').slice(1).join(':').trim() ?? null;
export function inspectRenderedRichContent(html, parser) {
  const errors=[], runs=[], images=[], lineBreaks=[], paragraphLayouts=[], paragraphNumbering=[], paragraphMarkFormatting=[];
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
  if (typeof html !== 'string' || !parser?.parseFromString) return {ok:false,errors:['HTML and a parser are required.'],runs,images,lineBreaks,paragraphLayouts,paragraphNumbering,paragraphMarkFormatting,paragraphCount:0};
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
  function visit(node, state, activeParagraph = null) {
    if (node.nodeType===3) {
      if (node.textContent) {
        if (activeParagraph === null) {
          if (node.textContent.trim()) errors.push('Rendered text occurs outside a recognized paragraph block.');
          return;
        }
        runs.push({paragraphIndex:activeParagraph,text:node.textContent,...state});
        paragraphOffsets.set(activeParagraph,(paragraphOffsets.get(activeParagraph) ?? 0)+node.textContent.length);
      }
      return;
    }
    if (node.nodeType!==1) return;
    const tag=node.tagName.toUpperCase();
    let thisParagraph = activeParagraph;
    if (['TABLE','THEAD','TBODY','TFOOT','TR','TD','TH','HR','PRE','CODE','SUP','SUB','FONT','MARK','SMALL','BIG'].includes(tag)) {
      errors.push('Unsupported rendered structural/semantic formatting tag: ' + tag + '.');
    }
    if (tag === 'STYLE') errors.push('Embedded CSS rules are unsupported in rendered rich-content inspection.');
    if (tag === 'LINK' && /stylesheet/i.test(node.getAttribute?.('rel') ?? '')) errors.push('External stylesheets are unsupported in rendered rich-content inspection.');
    if (tag === 'LI') {
      const list=node.parentNode;
      const ordered=list?.tagName?.toUpperCase()==='OL';
      const numberAttrs=['data-word-num-id','data-word-abstract-num-id','data-word-level','data-word-num-format','data-word-num-text','data-word-num-start','data-word-indent-left','data-word-indent-right','data-word-indent-first-line','data-word-indent-hanging'];
      const values=Object.fromEntries(numberAttrs.map(name=>[name,node.getAttribute?.(name)]));
      if (numberAttrs.some(name=>values[name]!==null && values[name]!==undefined)) {
        const number=(name)=>values[name]===null||values[name]===undefined?null:values[name];
        paragraphNumbering.push({paragraphIndex:paragraphIndex+1,numId:number('data-word-num-id')===null?null:Number(number('data-word-num-id')),abstractNumId:number('data-word-abstract-num-id')===null?null:Number(number('data-word-abstract-num-id')),level:number('data-word-level')===null?null:Number(number('data-word-level')),format:number('data-word-num-format')??(ordered?'decimal':'bullet'),text:number('data-word-num-text'),start:number('data-word-num-start')===null?null:Number(number('data-word-num-start')),indentation:{left:number('data-word-indent-left')===null?undefined:Number(number('data-word-indent-left')),right:number('data-word-indent-right')===null?undefined:Number(number('data-word-indent-right')),firstLine:number('data-word-indent-first-line')===null?undefined:Number(number('data-word-indent-first-line')),hanging:number('data-word-indent-hanging')===null?undefined:Number(number('data-word-indent-hanging'))}});
      } else errors.push('Rendered list item lacks explicit Word numbering provenance metadata.');
    }
    if (['P','H1','H2','H3','H4','H5','H6','LI','TD','TH'].includes(tag)) {
      paragraphIndex++;
      thisParagraph = paragraphIndex;
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
      let lineHeightPt = null, lineHeight = null;
      if (rawLineHeight !== null) {
        const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(rawLineHeight.toLowerCase());
        if (match) lineHeightPt = Number(match[1]) * (match[2] === 'px' ? 0.75 : 1);
        else if (/^\d+(?:\.\d+)?$/.test(rawLineHeight) && Number(rawLineHeight)>0) lineHeight = Number(rawLineHeight);
        else errors.push('Unsupported rendered paragraph line-height: '+rawLineHeight);
      }
      const spacing = {beforePt:readPoints('margin-top'),afterPt:readPoints('margin-bottom'),lineHeightPt};
      if(lineHeight!==null) spacing.lineHeight=lineHeight;
      paragraphLayouts.push({paragraphIndex,alignment,indentation,spacing});
      const markFonts={};
      for(const [name,key] of [['data-word-mark-font-ascii','ascii'],['data-word-mark-font-hansi','hAnsi'],['data-word-mark-font-east-asia','eastAsia'],['data-word-mark-font-cs','cs']]) {
        const value=node.getAttribute?.(name); if(value) markFonts[key]=value;
      }
      const markLanguage={};
      for(const [name,key] of [['data-word-mark-lang-val','val'],['data-word-mark-lang-east-asia','eastAsia'],['data-word-mark-lang-bidi','bidi']]) {
        const value=node.getAttribute?.(name); if(value) markLanguage[key]=value;
      }
      if(Object.keys(markFonts).length || Object.keys(markLanguage).length) paragraphMarkFormatting.push({paragraphIndex,fontFamily:Object.keys(markFonts).length?markFonts:null,language:Object.keys(markLanguage).length?markLanguage:null});
    }
    if (tag === 'BR') {
      if (thisParagraph === null) errors.push('Rendered line break occurs outside a recognized paragraph block.');
      const breakParagraph = Math.max(0,thisParagraph ?? paragraphIndex);
      lineBreaks.push({paragraphIndex:breakParagraph,textOffset:paragraphOffsets.get(breakParagraph) ?? 0,breakType:'textWrapping',markerOrder:nextMarkerOrder(breakParagraph)});
    }
    const style=node.getAttribute?.('style') ?? '';
    const allowed=new Set(['color','font-weight','font-style','text-decoration','list-style-type','font-size','text-align','margin-left','margin-right','text-indent','margin-top','margin-bottom','float','width','height','display','clear','max-width','line-height','font-family','text-transform','letter-spacing','font-kerning']);
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
    const csSizeAttr=node.getAttribute?.('data-word-font-size-cs'); if(csSizeAttr!==null && csSizeAttr!==undefined) {const parsed=Number(csSizeAttr);if(Number.isFinite(parsed)&&parsed>0) next.fontSizeCsPt=parsed;else errors.push('Unsupported rendered complex-script font size: '+csSizeAttr);}
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
    const boldCsAttr=node.getAttribute?.('data-word-bold-cs'); if(boldCsAttr!==null && boldCsAttr!==undefined) next.boldCs=boldCsAttr==='true';
    else if(['B','STRONG'].includes(tag)) next.bold=true;
    if(fontStyle!==null) next.italic=fontStyle.toLowerCase()==='italic';
    const italicCsAttr=node.getAttribute?.('data-word-italic-cs'); if(italicCsAttr!==null && italicCsAttr!==undefined) next.italicCs=italicCsAttr==='true';
    else if(['I','EM'].includes(tag)) next.italic=true;
    if(decoration!==null) next.underline=decoration.toLowerCase()==='underline';
    else if(tag==='U') next.underline=true;
    const color=formatting(node,'color'); if(color!==null) next.color=color;
    if(tag==='A') {const href=node.getAttribute('href'); if(!href) errors.push('Link without href.'); next.href=href;}
    if(tag==='IMG') {
      const assetPath=node.getAttribute('src'), alt=node.getAttribute('alt');
      if(!assetPath || alt===null) errors.push('Image lacks src or alt.');
      if (thisParagraph === null) errors.push('Rendered image occurs outside a recognized paragraph block.');
      const imageParagraph = Math.max(0,thisParagraph ?? paragraphIndex);
      const placementJson=node.getAttribute?.('data-word-image-placement-json');
      let placement={kind:'inline',requiresVisualReview:false};
      if(placementJson!==null&&placementJson!==undefined) {
        try {
          placement=JSON.parse(placementJson);
          if(!placement||!['inline','floating'].includes(placement.kind)) throw new Error('invalid placement kind');
        } catch { errors.push('Rendered image has invalid Word placement provenance metadata.'); placement={kind:'inline',requiresVisualReview:false}; }
      } else if(formatting(node,'float') && formatting(node,'float')!=='none') {
        errors.push('Rendered floating image lacks explicit Word placement provenance metadata.');
      }
      if(placement.kind==='floating') {
        const layout=paragraphLayouts.find(item=>item.paragraphIndex===imageParagraph);
        const expected=resolveDocxFloatingLayout(placement,layout?.indentation??{});
        if(!expected.ok) errors.push('Rendered floating image placement is unsupported: '+expected.error);
        else for(const [property,value] of Object.entries(expected.style)) {
          const actual=formatting(node,property);
          if(actual!==value) errors.push('Rendered floating image CSS '+property+' differs from the resolved Word anchor mapping.');
        }
      }
      images.push({assetPath,paragraphIndex:imageParagraph,order:order++,alt,textOffset:paragraphOffsets.get(imageParagraph) ?? 0,markerOrder:nextMarkerOrder(imageParagraph),placement});
    }
    for(const child of node.childNodes ?? []) visit(child,next,thisParagraph);
  }
  const initial={bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null,fontKerning:null,fontHint:null};
  for(const child of doc.body?.childNodes ?? []) visit(child,initial);
  if(!runs.length) errors.push('No rendered text runs.');
  return {ok:errors.length===0,errors,runs,images,lineBreaks,paragraphLayouts,paragraphNumbering,paragraphMarkFormatting,paragraphCount:paragraphIndex+1};
}
