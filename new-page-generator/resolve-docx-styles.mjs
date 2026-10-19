// Fail-closed Word run-formatting resolver. It inventories inherited typography,
// including script-specific fonts, language and spacing; fidelity still requires
// independent rendered-output comparison. Numbering and themes are not resolved here.
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=[\"']([^\"']*)[\"']/g)].map(m => [m[1], m[2]]));
const hasDuplicateAttrs = tag => { const keys=[...tag.matchAll(/([\w:.-]+)=[\"'][^\"']*[\"']/g)].map(m=>m[1]); return new Set(keys).size !== keys.length; };
const inner = (xml, tag) => new RegExp(String.raw`<w:${tag}(?:\s[^>]*)?>([\s\S]*?)<\/w:${tag}>`).exec(xml)?.[1] ?? '';
const directTag = (xml, tag) => new RegExp(String.raw`<w:${tag}\b[^>]*\/?\s*>`).exec(xml)?.[0] ?? null;
const propertyValue = (xml, tag) => {
  const found = directTag(xml, tag);
  if (!found) return undefined;
  const value = attrs(found)['w:val'];
  if (!/\/\s*>$/.test(found)) return {unsupported:true};
  if (tag !== 'color' && (hasDuplicateAttrs(found) || Object.keys(attrs(found)).some(key => key !== 'w:val'))) return {unsupported:true};
  if (tag === 'color') {
    if (hasDuplicateAttrs(found) || Object.keys(attrs(found)).some(key => !['w:val'].includes(key))) return {unsupported:true};
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
const unsupportedParagraphProps = xml => childProperties(xml.replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g,'')).filter(name => !['rPr','spacing','ind','jc','widowControl','numPr'].includes(name));
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
    const invalidAttributes=hasDuplicateAttrs(size) || Object.keys(attrs(size)).some(key=>key!=='w:val');
    if(!invalidAttributes && value && /^\d+$/.test(value) && Number(value)>0) result.fontSizePt=Number(value)/2;
    else result.fontSizePt={unsupported:true};
  }
  const fonts = directTag(xml,'rFonts');
  if (fonts) {
    const a = attrs(fonts);
    const allowedFontAttributes = new Set(['w:ascii','w:hAnsi','w:eastAsia','w:cs','w:hint']);
    const unsupportedTheme = hasDuplicateAttrs(fonts) || Object.keys(a).some(key => !allowedFontAttributes.has(key));
    const families = {};
    for (const key of ['ascii','hAnsi','eastAsia','cs']) if (a['w:'+key]) families[key] = a['w:'+key];
    if (unsupportedTheme) result.fontFamily = {unsupported:true};
    else if (Object.keys(families).length) result.fontFamily = families;
    // A hint without an explicit family changes script selection, not the font family itself.
    if (a['w:hint'] !== undefined) result.fontHint = ['default','eastAsia','cs'].includes(a['w:hint']) ? a['w:hint'] : {unsupported:true};
  }
  const lang = directTag(xml,'lang');
  if (lang) {
    const a = attrs(lang), value = {};
    for (const key of ['val','eastAsia','bidi']) if (a['w:'+key]) value[key] = a['w:'+key];
    result.language = hasDuplicateAttrs(lang) || Object.keys(a).some(key => !['w:val','w:eastAsia','w:bidi'].includes(key)) || !Object.keys(value).length ? {unsupported:true} : value;
  }
  const complexSize = directTag(xml,'szCs');
  if (complexSize) {
    const value = attrs(complexSize)['w:val'];
    result.fontSizeCsPt = !hasDuplicateAttrs(complexSize) && Object.keys(attrs(complexSize)).every(key=>key==='w:val') && value && /^\d+$/.test(value) && Number(value)>0 ? Number(value)/2 : {unsupported:true};
  }
  for (const key of ['bCs','iCs','caps']) {
    const value = propertyValue(xml,key);
    if (value?.unsupported) result[key] = {unsupported:true};
    else if (value) result[key] = value.value;
  }
  const spacing = directTag(xml,'spacing');
  if (spacing) {
    const value = attrs(spacing)['w:val'];
    result.letterSpacingPt = !hasDuplicateAttrs(spacing) && Object.keys(attrs(spacing)).every(key=>key==='w:val') && value && /^-?\d+$/.test(value) ? Number(value)/20 : {unsupported:true};
  }
  const kern = directTag(xml,'kern');
  if (kern) {
    const value = attrs(kern)['w:val'];
    result.fontKerningThresholdPt = !hasDuplicateAttrs(kern) && Object.keys(attrs(kern)).every(key=>key==='w:val') && value && /^\d+$/.test(value) ? Number(value)/2 : {unsupported:true};
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
    const runStyleBody=body.replace(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/g,'');
    const runStyleXml=inner(runStyleBody,'rPr');
    styleMap.set(id,{id,type:a['w:type'] ?? null,isDefault:['1','true','on'].includes((a['w:default']??'').toLowerCase()),basedOn:/<w:basedOn\b[^>]*\bw:val=["']([^"']+)["']/.exec(body)?.[1] ?? null,run:runProps(runStyleXml),unsupportedRun:unsupportedRunProps(runStyleXml),unsupportedParagraph:unsupportedParagraphProps(inner(body,'pPr')),paragraphMarkRun:inner(inner(body,'pPr'),'rPr')});
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

      found.unshift(style.run);
      id=style.basedOn;
    }
    return found;
  };
  const merge=(target,source)=>{
    for(const [key,value] of Object.entries(source)) {
      // OOXML font-family and language properties are attribute-level overrides:
      // a direct ascii value must not erase an inherited eastAsia/cs value.
      if ((key==='fontFamily'||key==='language') && value && typeof value==='object' && !value.unsupported) {
        const prior=target[key];
        if (prior?.unsupported && key==='fontFamily' && ['ascii','hAnsi','eastAsia','cs'].every(script=>typeof value[script]==='string'&&value[script])) {
          // A fully explicit four-script font tuple safely replaces an unresolved inherited theme tuple.
          target[key]={...value};
        } else {
          target[key]={...(prior && typeof prior==='object' ? prior : {}),...value};
        }
      } else target[key]=value;
    }
  };
  const effective={b:false,i:false,u:false,color:null,fontSizePt:null};
  merge(effective,runProps(defaultsRun));
  const pStyle=/<w:pStyle\b[^>]*\bw:val=[\"']([^\"']+)[\"']/.exec(paragraphXml)?.[1] ?? defaultParagraphId;
  if(pStyle) for(const props of chain(pStyle,'paragraph style','paragraph')) merge(effective,props);
  const paragraphMarkFormatting={};
  const defaultMarkFormatting=runProps(defaultsRun);
  for(const key of ['fontFamily','language']) {
    const value=defaultMarkFormatting[key];
    if(value && typeof value==='object' && !value.unsupported) paragraphMarkFormatting[key]={...value};
  }
  if(pStyle) {
    const markChain=[], markSeen=new Set(); let markId=pStyle;
    while(markId && !markSeen.has(markId)) {
      markSeen.add(markId);
      const style=styleMap.get(markId); if(!style) break;
      markChain.unshift(style); markId=style.basedOn;
    }
    for(const style of markChain) {
      for(const key of ['fontFamily','language']) {
        const value=style.run?.[key];
        if(value && typeof value==='object' && !value.unsupported) paragraphMarkFormatting[key]={...(paragraphMarkFormatting[key]??{}),...value};
      }
      const markRun=style.paragraphMarkRun ?? '';
      for(const name of unsupportedRunProps(markRun)) errors.push('Unsupported paragraph-mark run property w:'+name+' in Word style '+style.id+'.');
      for(const [key,value] of Object.entries(runProps(markRun))) {
        if(value?.unsupported) errors.push('Unsupported paragraph-mark formatting: '+key+' in Word style '+style.id+'.');
        else if ((key==='fontFamily'||key==='language') && value && typeof value==='object') paragraphMarkFormatting[key]={...(paragraphMarkFormatting[key]??{}),...value};
        else paragraphMarkFormatting[key]=value;
      }
    }
  }
  const pRun=inner(inner(paragraphXml,'pPr'),'rPr');
  if(pRun.trim()) {
    for(const name of unsupportedRunProps(pRun)) errors.push('Unsupported paragraph-mark run property w:'+name+'.');
    for(const [key,value] of Object.entries(runProps(pRun))) {
      if(value?.unsupported) errors.push('Unsupported paragraph-mark formatting: '+key+'.');
      else if ((key==='fontFamily'||key==='language') && value && typeof value==='object') paragraphMarkFormatting[key]={...(paragraphMarkFormatting[key]??{}),...value};
      else paragraphMarkFormatting[key]=value;
    }
  }
  const rStyle=/<w:rStyle\b[^>]*\bw:val=[\"']([^\"']+)[\"']/.exec(runXml)?.[1] ?? null;
  if(rStyle) for(const props of chain(rStyle,'character style','character')) merge(effective,props);
  const directRun=inner(runXml,'rPr');
  for(const name of unsupportedRunProps(directRun).filter(name=>name!=='rStyle')) errors.push('Unsupported direct run property w:'+name+'.');
  merge(effective,runProps(directRun));
  if (effective.fontKerningThresholdPt !== undefined) {
    if (effective.fontSizePt === null || effective.fontKerningThresholdPt?.unsupported) errors.push('Word font kerning threshold requires an explicit supported font size.');
    else effective.fontKerning = effective.fontSizePt >= effective.fontKerningThresholdPt ? 'normal' : 'none';
  }
  for(const [key,value] of Object.entries(effective)) if(value?.unsupported) errors.push('Unsupported inherited Word formatting: '+key+'.');
  for(const [key,value] of Object.entries(paragraphMarkFormatting)) if(value?.unsupported) errors.push('Unsupported paragraph-mark formatting: '+key+'.');
  return {ok:errors.length===0,errors,formatting:errors.length?null:effective,paragraphMarkFormatting};
}
