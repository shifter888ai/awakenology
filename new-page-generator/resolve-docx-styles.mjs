// Minimal, fail-closed resolver for the subset of Word run formatting represented
// by the rich-content inventory. This does not resolve fonts, sizes, language,
// paragraph layout, numbering, theme colors, or other OOXML properties.
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=[\"']([^\"']*)[\"']/g)].map(m => [m[1], m[2]]));
const inner = (xml, tag) => new RegExp('<w:' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/w:' + tag + '>').exec(xml)?.[1] ?? '';
const directTag = (xml, tag) => new RegExp('<w:' + tag + '\\b[^>]*\\/?\\s*>').exec(xml)?.[0] ?? null;
const propertyValue = (xml, tag) => {
  const found = directTag(xml, tag);
  if (!found) return undefined;
  const value = attrs(found)['w:val'];
  if (tag === 'color') {
    if (attrs(found)['w:themeColor'] || attrs(found)['w:themeTint'] || attrs(found)['w:themeShade']) return {unsupported:true};
    return value && /^[0-9a-f]{6}$/i.test(value) ? {value:'#'+value.toLowerCase()} : {unsupported:true};
  }
  if (tag === 'b' || tag === 'i' || tag === 'u') {
    if (tag === 'u' && value && !['single','0','false','off','none'].includes(value.toLowerCase())) return {unsupported:true};
    if (value && !['1','true','on','0','false','off','none','single'].includes(value.toLowerCase())) return {unsupported:true};
    return {value: !value || !['0','false','off','none'].includes(value.toLowerCase())};
  }
  return undefined;
};
function runProps(xml) {
  const result={};
  for (const key of ['b','i','u','color']) {
    const value=propertyValue(xml,key);
    if (value?.unsupported) result[key]={unsupported:true};
    else if (value) result[key]=value.value;
  }
  return result;
}
export function resolveDocxRunFormatting({stylesXml, paragraphXml, runXml}) {
  const errors=[];
  if (typeof stylesXml!=='string' || typeof paragraphXml!=='string' || typeof runXml!=='string') {
    return {ok:false,errors:['Styles XML, paragraph XML, and run XML are required.'],formatting:null};
  }
  const styleMap=new Map();
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const a=attrs(match[1]), body=match[2], id=a['w:styleId'];
    if (!id || styleMap.has(id)) { errors.push('Missing or duplicate Word style ID.'); continue; }
    styleMap.set(id,{id,basedOn:/<w:basedOn\b[^>]*\bw:val=[\"']([^\"']+)[\"']/.exec(body)?.[1] ?? null,run:runProps(inner(body,'rPr'))});
  }
  const chain=(id,label)=>{
    const found=[], seen=new Set();
    while(id) {
      if(seen.has(id)){errors.push('Cyclic Word style inheritance in '+label+': '+id+'.');break;}
      seen.add(id);
      const style=styleMap.get(id);
      if(!style){errors.push('Missing Word style '+id+' referenced by '+label+'.');break;}
      found.unshift(style.run);
      id=style.basedOn;
    }
    return found;
  };
  const merge=(target,source)=>{for(const [key,value] of Object.entries(source)) target[key]=value;};
  const effective={b:false,i:false,u:false,color:null};
  const defaults=inner(inner(stylesXml,'docDefaults'),'rPrDefault');
  merge(effective,runProps(defaults));
  const pStyle=/<w:pStyle\b[^>]*\bw:val=[\"']([^\"']+)[\"']/.exec(paragraphXml)?.[1] ?? null;
  if(pStyle) for(const props of chain(pStyle,'paragraph style')) merge(effective,props);
  const pRun=inner(inner(paragraphXml,'pPr'),'rPr');
  merge(effective,runProps(pRun));
  const rStyle=/<w:rStyle\b[^>]*\bw:val=[\"']([^\"']+)[\"']/.exec(runXml)?.[1] ?? null;
  if(rStyle) for(const props of chain(rStyle,'character style')) merge(effective,props);
  merge(effective,runProps(inner(runXml,'rPr')));
  for(const [key,value] of Object.entries(effective)) if(value?.unsupported) errors.push('Unsupported inherited Word formatting: '+key+'.');
  return {ok:errors.length===0,errors,formatting:errors.length?null:effective};
}
