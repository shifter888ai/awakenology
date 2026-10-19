// Resolve a paragraph's numbering reference to its concrete Word list level.
// This inventories source semantics; it does not by itself certify HTML list rendering.
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:.-]+)=["']([^"']*)["']/g)].map(m => [m[1], m[2]]));
const body = (xml, tag) => new RegExp('<w:'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/w:'+tag+'>').exec(xml)?.[1] ?? '';
const self = (xml, tag) => new RegExp('<w:'+tag+'\\b[^>]*\\/\\s*>').exec(xml)?.[0] ?? null;
const val = (xml, tag) => { const found=self(xml,tag); return found ? attrs(found)['w:val'] : null; };
export function resolveDocxNumbering({ numberingXml, paragraphXml }) {
 const errors=[];
 if(typeof numberingXml!=='string'||typeof paragraphXml!=='string') return {ok:false,errors:['Numbering XML and paragraph XML are required.'],numbering:null};
 const numPr=body(body(paragraphXml,'pPr'),'numPr');
 if(!numPr) return {ok:true,errors,numbering:null};
 const numId=val(numPr,'numId'), level=val(numPr,'ilvl')??'0';
 if(numId==='0') return {ok:true,errors,numbering:null};
 if(!/^\d+$/.test(numId??'')||!/^\d+$/.test(level)||Number(level)>8) return {ok:false,errors:['Malformed Word numbering reference.'],numbering:null};
 const abstracts=new Map(), concrete=new Map();
 for(const m of numberingXml.matchAll(/<w:abstractNum\b([^>]*)>([\s\S]*?)<\/w:abstractNum>/g)){
  const id=attrs(m[1])['w:abstractNumId'];
  if(!id||abstracts.has(id)){errors.push('Missing or duplicate abstract numbering ID.');continue;}
  const levels=new Map();
  for(const l of m[2].matchAll(/<w:lvl\b([^>]*)>([\s\S]*?)<\/w:lvl>/g)){
   const n=attrs(l[1])['w:ilvl'], fmt=val(l[2],'numFmt'), text=val(l[2],'lvlText'), start=val(l[2],'start')??'1';
   if(!/^\d+$/.test(n??'')||Number(n)>8||levels.has(n)||!fmt||text===null||!/^\d+$/.test(start)){errors.push('Malformed or incomplete Word numbering level.');continue;}
   if(!['decimal','upperRoman','lowerRoman','upperLetter','lowerLetter','bullet','none'].includes(fmt)){errors.push('Unsupported Word numbering format '+fmt+'.');continue;}
   const ind=self(body(l[2],'pPr'),'ind'), ia=ind?attrs(ind):{}, indentation={};
   if(ind&&Object.keys(ia).some(k=>!['w:left','w:right','w:firstLine','w:hanging'].includes(k))) errors.push('Unsupported numbering indentation attributes.');
   for(const k of ['left','right','firstLine','hanging']) if(ia['w:'+k]!==undefined){if(!/^-?\d+$/.test(ia['w:'+k])) errors.push('Malformed numbering indentation.');else indentation[k]=Number(ia['w:'+k]);}
   levels.set(n,{level:Number(n),format:fmt,text,start:Number(start),indentation});
  }
  abstracts.set(id,levels);
 }
 for(const m of numberingXml.matchAll(/<w:num\b([^>]*)>([\s\S]*?)<\/w:num>/g)){
  const id=attrs(m[1])['w:numId'], abstractId=val(m[2],'abstractNumId');
  if(!id||concrete.has(id)||!abstractId){errors.push('Missing or duplicate concrete numbering ID.');continue;}
  const overrides=new Map();
  for(const o of m[2].matchAll(/<w:lvlOverride\b([^>]*)>([\s\S]*?)<\/w:lvlOverride>/g)){
   const n=attrs(o[1])['w:ilvl'], start=val(o[2],'startOverride');
   if(!/^\d+$/.test(n??'')||Number(n)>8||overrides.has(n)||(start!==null&&!/^\d+$/.test(start))) errors.push('Malformed numbering level override.');
   else overrides.set(n,start===null?null:Number(start));
  }
  concrete.set(id,{abstractId,overrides});
 }
 const item=concrete.get(numId);
 if(!item) return {ok:false,errors:[...errors,'Missing concrete Word numbering definition '+numId+'.'],numbering:null};
 const levelInfo=abstracts.get(item.abstractId)?.get(level);
 if(!levelInfo) return {ok:false,errors:[...errors,'Missing abstract numbering level '+level+'.'],numbering:null};
 const numbering={numId:Number(numId),abstractNumId:Number(item.abstractId),...levelInfo,start:item.overrides.get(level)??levelInfo.start};
 return {ok:errors.length===0,errors,numbering};
}
