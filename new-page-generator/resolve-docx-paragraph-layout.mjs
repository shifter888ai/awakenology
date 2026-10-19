// Conservative resolver for the supported Word paragraph-layout subset.
// Values remain in OOXML twips so a later renderer can convert units explicitly.
// This module does not certify page/section layout, numbering, or floating objects.
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=["']([^"']*)["']/g)].map(m => [m[1],m[2]]));
const invalidAttrs = (tag, allowed) => { const keys=[...tag.matchAll(/([\w:.-]+)=["'][^"']*["']/g)].map(m=>m[1]); return new Set(keys).size!==keys.length || keys.some(key=>!allowed.includes(key)); };
const bodyOf = (xml, tag) => new RegExp(String.raw`<w:${tag}(?:\s[^>]*)?>([\s\S]*?)<\/w:${tag}>`).exec(xml)?.[1] ?? '';
const direct = (xml, tag) => new RegExp(String.raw`<w:${tag}\b[^>]*\/?\s*>`).exec(xml)?.[0] ?? null;
const children = xml => [...xml.matchAll(/<w:([A-Za-z][A-Za-z0-9]*)\b[^>]*\/?\s*>/g)].map(m=>m[1]);
const layoutProps = xml => {
  const result = {};
  // Run properties nested under pPr (paragraph-mark formatting) are not paragraph layout.
  const paragraphOnly=xml.replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g,'').replace(/<w:rPr\b[^>]*\/>/g,'');
  const jc = direct(paragraphOnly,'jc');
  if (jc) {
    const value=attrs(jc)['w:val'];
    if (invalidAttrs(jc,['w:val']) || !['left','right','center','both','start','end','distribute'].includes(value)) result.alignment={unsupported:true};
    else result.alignment=value;
  }
  const spacing = direct(paragraphOnly,'spacing');
  if (spacing) {
    const a = attrs(spacing), parsed = {};
    if (invalidAttrs(spacing,['w:before','w:after','w:line','w:lineRule','w:beforeAutospacing','w:afterAutospacing','w:beforeLines','w:afterLines'])) parsed.unsupported={unsupported:true};
    for (const key of ['before','after']) {
      if (a['w:'+key] !== undefined) {
        if (!/^\d+$/.test(a['w:'+key])) parsed[key+'Pt'] = {unsupported:true};
        else parsed[key+'Pt'] = Number(a['w:'+key]) / 20;
      }
    }
    if (a['w:line'] !== undefined) {
      const rule = a['w:lineRule'] ?? 'auto';
      if (!/^\d+$/.test(a['w:line'])) parsed.lineHeightPt = {unsupported:true};
      else if (rule === 'exact') parsed.lineHeightPt = Number(a['w:line']) / 20;
      else if (rule === 'auto') parsed.lineHeight = Number(a['w:line']) / 240;
      else if (rule === 'atLeast') parsed.lineHeightPt = {unsupported:true};
      else parsed.lineHeightPt = {unsupported:true};
    }
    for (const key of ['beforeAutospacing','afterAutospacing','beforeLines','afterLines']) {
      if (a['w:'+key] !== undefined) parsed.unsupported = {unsupported:true};
    }
    if (a['w:lineRule'] !== undefined && !['exact','auto','atLeast'].includes(a['w:lineRule'])) parsed.unsupported = {unsupported:true};
    result.spacing = parsed;
  }
  const ind = direct(paragraphOnly,'ind');
  if (ind) {
    const a=attrs(ind), parsed={};
    if (invalidAttrs(ind,['w:left','w:right','w:firstLine','w:hanging','w:start','w:end','w:leftChars','w:rightChars','w:firstLineChars','w:hangingChars'])) parsed.unsupported={unsupported:true};
    for (const [name,key] of [['left','left'],['right','right'],['firstLine','firstLine'],['hanging','hanging']]) {
      const raw=a['w:'+name];
      if (raw !== undefined) {
        if (!/^-?\d+$/.test(raw)) parsed[key]={unsupported:true};
        else parsed[key]=Number(raw);
      }
    }
    if (a['w:start'] !== undefined || a['w:end'] !== undefined) parsed.unsupported={unsupported:true};
    for (const key of ['leftChars','rightChars','firstLineChars','hangingChars']) {
      const raw=a['w:'+key];
      // Explicit zero character indentation has no layout effect; nonzero values need font-metric resolution.
      if (raw !== undefined && (!/^-?\d+$/.test(raw) || Number(raw)!==0)) parsed.unsupported={unsupported:true};
    }
    if (parsed.firstLine !== undefined && parsed.hanging !== undefined) parsed.unsupported={unsupported:true};
    result.indentation=parsed;
  }
  return result;
};
const unsupported = xml => children(xml.replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g,'').replace(/<w:rPr\b[^>]*\/>/g,'').replace(/<w:numPr\b[^>]*>[\s\S]*?<\/w:numPr>/g,'')).filter(name=>!['jc','ind','spacing','pStyle','basedOn','pPr','widowControl','numPr'].includes(name));
export function resolveDocxParagraphLayout({stylesXml,paragraphXml}) {
  const errors=[];
  if (typeof stylesXml!=='string' || typeof paragraphXml!=='string') return {ok:false,errors:['Styles XML and paragraph XML are required.'],layout:null};
  const map=new Map();
  for(const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const a=attrs(m[1]), id=a['w:styleId'];
    if(!id || map.has(id)){errors.push('Missing or duplicate Word style ID.');continue;}
    map.set(id,{type:a['w:type']??null,isDefault:['1','true','on'].includes((a['w:default']??'').toLowerCase()),basedOn:/<w:basedOn\b[^>]*\bw:val=["']([^"']+)["']/.exec(m[2])?.[1]??null,pPr:bodyOf(m[2],'pPr')});
  }
  const defaultParagraphStyles=[...map.entries()].filter(([,style])=>style.type==='paragraph'&&style.isDefault);
  if(defaultParagraphStyles.length>1) errors.push('Multiple default Word paragraph styles are defined.');
  const defaultParagraphId=defaultParagraphStyles[0]?.[0]??null;
  const merge=(target,source)=>{for(const [k,v] of Object.entries(source)){if(k==='indentation' && v && typeof v==='object' && !v.unsupported){target.indentation={...(target.indentation??{}),...v};}else if(k==='spacing' && v && typeof v==='object' && !v.unsupported){target.spacing={...(target.spacing??{}),...v};}else target[k]=v;}};
  const result={alignment:'left',indentation:{left:0,right:0},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}};
  const defaults=bodyOf(bodyOf(stylesXml,'docDefaults'),'pPrDefault');
  const defaultsP=bodyOf(defaults,'pPr');
  for(const name of unsupported(defaultsP)) errors.push('Unsupported document-default paragraph property w:'+name+'.');
  merge(result,layoutProps(defaultsP));
  const id=/<w:pStyle\b[^>]*\bw:val=["']([^"']+)["']/.exec(paragraphXml)?.[1]??defaultParagraphId;
  if(id) {
    const chain=[], seen=new Set(); let current=id;
    while(current) {
      if(seen.has(current)){errors.push('Cyclic Word paragraph-style inheritance: '+current+'.');break;}
      seen.add(current);
      const style=map.get(current);
      if(!style){errors.push('Missing Word paragraph style '+current+'.');break;}
      if(style.type!=='paragraph') errors.push('Word style '+current+' has type '+style.type+'; expected paragraph.');
      for(const name of unsupported(style.pPr)) errors.push('Unsupported paragraph property w:'+name+' in Word style '+current+'.');
      chain.unshift(style); current=style.basedOn;
    }
    for(const style of chain) merge(result,layoutProps(style.pPr));
  }
  const pPr=bodyOf(paragraphXml,'pPr');
  // Numbering semantics are resolved independently by resolve-docx-numbering.mjs.
  for(const name of unsupported(pPr)) errors.push('Unsupported direct paragraph property w:'+name+'.');
  merge(result,layoutProps(pPr));
  for(const [key,value] of Object.entries(result)) {
    if(value?.unsupported) errors.push('Unsupported paragraph layout value: '+key+'.');
    if(key==='indentation' && value && typeof value==='object') for(const [side,n] of Object.entries(value)) if(side!=='unsupported' && n?.unsupported) errors.push('Unsupported paragraph indentation: '+side+'.');
  }
  if(result.indentation?.unsupported) errors.push('Character-based or conflicting Word indentation requires independent resolution.');
  if(result.spacing?.unsupported) errors.push('Unsupported Word paragraph spacing requires independent resolution.');
  for (const [key,value] of Object.entries(result.spacing ?? {})) if (value?.unsupported) errors.push('Unsupported Word paragraph spacing: '+key+'.');
  return {ok:errors.length===0,errors,layout:result};
}
