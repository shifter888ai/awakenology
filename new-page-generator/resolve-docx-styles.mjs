// Fail-closed resolver for the supported Word run-formatting subset: bold, italic,
// underline, explicit RGB color and half-point font size. It does not resolve font
// families, language, complex-script sizes, paragraph layout, numbering or themes.
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=[\"']([^\"']*)[\"']/g)].map(m => [m[1], m[2]]));
const inner = (xml, tag) => new RegExp(String.raw`<w:${tag}(?:\s[^>]*)?>([\s\S]*?)<\/w:${tag}>`).exec(xml)?.[1] ?? '';
const directTag = (xml, tag) => new RegExp(String.raw`<w:${tag}\b[^>]*\/?\s*>`).exec(xml)?.[0] ?? null;
const propertyValue = (xml, tag) => {
  const found = directTag(xml, tag);
  if (!found) return undefined;
  const value = attrs(found)['w:val'];
  if (tag === 'color') {
    if (attrs(found)['w:themeColor'] || attrs(found)['w:themeTint'] || attrs(found)['w:themeShade']) return {unsupported:true};
    return value && /^[0-9a-f]{6}$/i.test(value) ? {value:'#'+value.toLowerCase()} : {unsupported:true};
  }
  if (['b','i','u','bCs','iCs','caps'].includes(tag)) {
    if (tag === 'u' && value && !['single','0','false','off','none'].includes(value.toLowerCase())) return {unsupported:true};
    if (value && !['1','true','on','0','false','off','none','single'].includes(value.toLowerCase())) return {unsupported:true};
    return {value: !value || !['0','false','off','none'].includes(value.toLowerCase())};
  }
  return undefined;
};
const childProperties = xml => [...xml.matchAll(/<w:([A-Za-z][A-Za-z0-9]*)\b[^>]*\/?\s*>/g)].map(match => match[1]);
const unsupportedRunProps = xml => childProperties(xml).filter(name => !['b','i','u','color','sz','rFonts','lang','szCs','bCs','iCs','caps','spacing','kern','rStyle'].includes(name));
const unsupportedParagraphProps = xml => childProperties(xml.replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g,'')).filter(name => !['rPr','spacing','ind','jc','widowControl'].includes(name));
function runProps(xml) {
  const result={};
  for (const key of ['b','i','u','color']) {
    const value=propertyValue(xml,key);
    if (value?.unsupported) result[key]={unsupported:true};
    else if (value) result[key]=value.value;
  }
  const size=directTag(xml,'sz');
  if(size) {
    const value=attrs(size)['w:val'];
    if(value && /^\d+$/.test(value) && Number(value)>0) result.fontSizePt=Number(value)/2;
    else result.fontSizePt={unsupported:true};
  }
  const fonts = directTag(xml,'rFonts');
  if (fonts) {
    const a = attrs(fonts);
    const unsupportedTheme = Object.keys(a).some(key => /Theme$/i.test(key) && key.startsWith('w:'));
    const families = {};
    for (const key of ['ascii','hAnsi','eastAsia','cs']) if (a['w:'+key]) families[key] = a['w:'+key];
    result.fontFamily = unsupportedTheme || !Object.keys(families).length ? {unsupported:true} : families;
  }
  const lang = directTag(xml,'lang');
  if (lang) {
    const a = attrs(lang), value = {};
    for (const key of ['val','eastAsia','bidi']) if (a['w:'+key]) value[key] = a['w:'+key];
    result.language = Object.keys(value).length ? value : {unsupported:true};
  }
  const complexSize = directTag(xml,'szCs');
  if (complexSize) {
    const value = attrs(complexSize)['w:val'];
    result.fontSizeCsPt = value && /^\d+$/.test(value) && Number(value)>0 ? Number(value)/2 : {unsupported:true};
  }
  for (const key of ['bCs','iCs','caps']) {
    const value = propertyValue(xml,key);
    if (value?.unsupported) result[key] = {unsupported:true};
    else if (value) result[key] = value.value;
  }
  const spacing = directTag(xml,'spacing');
  if (spacing) {
    const value = attrs(spacing)['w:val'];
    result.letterSpacingPt = value && /^-?\d+$/.test(value) ? Number(value)/20 : {unsupported:true};
  }
  const kern = directTag(xml,'kern');
  if (kern) {
    const value = attrs(kern)['w:val'];
    result.fontKerningThresholdPt = value && /^\d+$/.test(value) ? Number(value)/2 : {unsupported:true};
  }
  return result;
}
export function resolveDocxRunFormatting({stylesXml, paragraphXml, runXml}) {
  const errors=[];
  if (typeof stylesXml!=='string' || typeof paragraphXml!=='string' || typeof runXml!=='string') {
    return {ok:false,errors:['Styles XML, paragraph XML, and run XML are required.'],formatting:null};
  }
  const styleMap=new Map();
  const defaults=inner(inner(stylesXml,'docDefaults'),'rPrDefault');
  const defaultsRun=inner(defaults,'rPr');
  for(const name of unsupportedRunProps(defaultsRun)) errors.push('Unsupported document-default run property w:'+name+'.');
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const a=attrs(match[1]), body=match[2], id=a['w:styleId'];
    if (!id || styleMap.has(id)) { errors.push('Missing or duplicate Word style ID.'); continue; }
    styleMap.set(id,{id,type:a['w:type'] ?? null,isDefault:['1','true','on'].includes((a['w:default']??'').toLowerCase()),basedOn:/<w:basedOn\b[^>]*\bw:val=["']([^"']+)["']/.exec(body)?.[1] ?? null,run:runProps(inner(body,'rPr')),unsupportedRun:unsupportedRunProps(inner(body,'rPr')),unsupportedParagraph:unsupportedParagraphProps(inner(body,'pPr')),paragraphMarkRun:inner(inner(body,'pPr'),'rPr')});
  }
  const defaultParagraphStyles=[...styleMap.values()].filter(style=>style.type==='paragraph'&&style.isDefault);
  if(defaultParagraphStyles.length>1) errors.push('Multiple default Word paragraph styles are defined.');
  const defaultParagraphId=defaultParagraphStyles[0]?.id??null;
  const chain=(id,label,expectedType)=>{
    const found=[], seen=new Set();
    while(id) {
      if(seen.has(id)){errors.push('Cyclic Word style inheritance in '+label+': '+id+'.');break;}
      seen.add(id);
      const style=styleMap.get(id);
      if(!style){errors.push('Missing Word style '+id+' referenced by '+label+'.');break;}
      if(style.type!==expectedType) errors.push('Word style '+style.id+' has type '+style.type+'; expected '+expectedType+' for '+label+'.');
      for(const name of style.unsupportedRun) errors.push('Unsupported run property w:'+name+' in Word style '+style.id+'.');
      for(const name of style.unsupportedParagraph) errors.push('Unsupported paragraph property w:'+name+' in Word style '+style.id+'.');
      if(style.paragraphMarkRun.trim()) errors.push('Paragraph-mark run formatting in Word style '+style.id+' requires independent handling.');
      found.unshift(style.run);
      id=style.basedOn;
    }
    return found;
  };
  const merge=(target,source)=>{for(const [key,value] of Object.entries(source)) target[key]=value;};
  const effective={b:false,i:false,u:false,color:null,fontSizePt:null};
  merge(effective,runProps(defaultsRun));
  const pStyle=/<w:pStyle\b[^>]*\bw:val=[\"']([^\"']+)[\"']/.exec(paragraphXml)?.[1] ?? null;
  if(pStyle) for(const props of chain(pStyle,'paragraph style','paragraph')) merge(effective,props);
  const pRun=inner(inner(paragraphXml,'pPr'),'rPr');
  if(pRun.trim()) {
    for(const name of unsupportedRunProps(pRun)) errors.push('Unsupported paragraph-mark run property w:'+name+'.');
    for(const [key,value] of Object.entries(runProps(pRun))) if(value?.unsupported) errors.push('Unsupported paragraph-mark formatting: '+key+'.');
  }
  const rStyle=/<w:rStyle\b[^>]*\bw:val=[\"']([^\"']+)[\"']/.exec(runXml)?.[1] ?? null;
  if(rStyle) for(const props of chain(rStyle,'character style','character')) merge(effective,props);
  const directRun=inner(runXml,'rPr');
  for(const name of unsupportedRunProps(directRun).filter(name=>name!=='rStyle')) errors.push('Unsupported direct run property w:'+name+'.');
  merge(effective,runProps(directRun));
  if (effective.bCs !== undefined && effective.bCs !== effective.b) errors.push('Complex-script bold differs from general bold and requires script-aware rendering.');
  if (effective.iCs !== undefined && effective.iCs !== effective.i) errors.push('Complex-script italic differs from general italic and requires script-aware rendering.');
  if (effective.fontSizeCsPt !== undefined && effective.fontSizePt !== null && effective.fontSizeCsPt !== effective.fontSizePt) errors.push('Complex-script font size differs from general font size and requires script-aware rendering.');
  if (effective.fontKerningThresholdPt !== undefined) {
    if (effective.fontSizePt === null || effective.fontKerningThresholdPt?.unsupported) errors.push('Word font kerning threshold requires an explicit supported font size.');
    else effective.fontKerning = effective.fontSizePt >= effective.fontKerningThresholdPt ? 'normal' : 'none';
  }
  for(const [key,value] of Object.entries(effective)) if(value?.unsupported) errors.push('Unsupported inherited Word formatting: '+key+'.');
  return {ok:errors.length===0,errors,formatting:errors.length?null:effective};
}
