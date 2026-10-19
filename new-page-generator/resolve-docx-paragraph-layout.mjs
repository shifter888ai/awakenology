// Conservative resolver for the supported Word paragraph-layout subset.
// Values remain in OOXML twips so a later renderer can convert units explicitly.
// This module does not certify page/section layout, numbering, or floating objects.
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=["']([^"']*)["']/g)].map(m => [m[1],m[2]]));
const bodyOf = (xml, tag) => new RegExp(String.raw`<w:${tag}(?:\s[^>]*)?>([\s\S]*?)<\/w:${tag}>`).exec(xml)?.[1] ?? '';
const direct = (xml, tag) => new RegExp(String.raw`<w:${tag}\b[^>]*\/?\s*>`).exec(xml)?.[0] ?? null;
const children = xml => [...xml.matchAll(/<w:([A-Za-z][A-Za-z0-9]*)\b[^>]*\/?\s*>/g)].map(m=>m[1]);
const layoutProps = xml => {
  const result = {};
  const jc = direct(xml,'jc');
  if (jc) {
    const value=attrs(jc)['w:val'];
    if (!['left','right','center','both','start','end','distribute'].includes(value)) result.alignment={unsupported:true};
    else result.alignment=value;
  }
  const ind = direct(xml,'ind');
  if (ind) {
    const a=attrs(ind), parsed={};
    for (const [name,key] of [['left','left'],['right','right'],['firstLine','firstLine'],['hanging','hanging']]) {
      const raw=a['w:'+name];
      if (raw !== undefined) {
        if (!/^-?\d+$/.test(raw)) parsed[key]={unsupported:true};
        else parsed[key]=Number(raw);
      }
    }
    if (a['w:start'] !== undefined || a['w:end'] !== undefined || a['w:leftChars'] !== undefined || a['w:rightChars'] !== undefined || a['w:firstLineChars'] !== undefined || a['w:hangingChars'] !== undefined) parsed.unsupported={unsupported:true};
    if (parsed.firstLine !== undefined && parsed.hanging !== undefined) parsed.unsupported={unsupported:true};
    result.indentation=parsed;
  }
  return result;
};
const unsupported = xml => children(xml).filter(name=>!['jc','ind','pStyle','basedOn','pPr','rPr'].includes(name));
export function resolveDocxParagraphLayout({stylesXml,paragraphXml}) {
  const errors=[];
  if (typeof stylesXml!=='string' || typeof paragraphXml!=='string') return {ok:false,errors:['Styles XML and paragraph XML are required.'],layout:null};
  const map=new Map();
  for(const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const a=attrs(m[1]), id=a['w:styleId'];
    if(!id || map.has(id)){errors.push('Missing or duplicate Word style ID.');continue;}
    map.set(id,{type:a['w:type']??null,basedOn:/<w:basedOn\b[^>]*\bw:val=["']([^"']+)["']/.exec(m[2])?.[1]??null,pPr:bodyOf(m[2],'pPr')});
  }
  const merge=(target,source)=>{for(const [k,v] of Object.entries(source)){if(k==='indentation' && v && typeof v==='object' && !v.unsupported){target.indentation={...(target.indentation??{}),...v};}else target[k]=v;}};
  const result={alignment:'left',indentation:{left:0,right:0}};
  const defaults=bodyOf(bodyOf(stylesXml,'docDefaults'),'pPrDefault');
  const defaultsP=bodyOf(defaults,'pPr');
  for(const name of unsupported(defaultsP)) errors.push('Unsupported document-default paragraph property w:'+name+'.');
  merge(result,layoutProps(defaultsP));
  const id=/<w:pStyle\b[^>]*\bw:val=["']([^"']+)["']/.exec(paragraphXml)?.[1]??null;
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
  for(const name of unsupported(pPr)) errors.push('Unsupported direct paragraph property w:'+name+'.');
  merge(result,layoutProps(pPr));
  for(const [key,value] of Object.entries(result)) {
    if(value?.unsupported) errors.push('Unsupported paragraph layout value: '+key+'.');
    if(key==='indentation' && value && typeof value==='object') for(const [side,n] of Object.entries(value)) if(side!=='unsupported' && n?.unsupported) errors.push('Unsupported paragraph indentation: '+side+'.');
  }
  if(result.indentation?.unsupported) errors.push('Character-based or conflicting Word indentation requires independent resolution.');
  return {ok:errors.length===0,errors,layout:result};
}
