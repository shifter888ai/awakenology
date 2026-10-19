const attributes = xml => Object.fromEntries([...(xml??"").matchAll(/([\w:.-]+)=["']([^"']*)["']/g)].map(match=>[match[1],match[2]]));
const emuToPt = value => Number(value)/12700;
const twipsToPt = value => Number(value)/20;
const pt = value => Number(value.toFixed(4)).toString();

function position(xml, tag) {
  const match=new RegExp("<wp:"+tag+"\\b([^>]*)>([\\s\\S]*?)</wp:"+tag+">").exec(xml??"");
  if(!match) return null;
  const relativeFrom=attributes(match[1]).relativeFrom;
  const offset=/<wp:posOffset>(-?\d+)<\/wp:posOffset>/.exec(match[2])?.[1];
  return {relativeFrom,offset:offset===undefined?null:Number(offset)};
}

export function resolveDocxFloatingLayout(placement, paragraphIndentation={}) {
  if(!placement||placement.kind!=="floating") return {ok:true,css:null,style:null};
  const anchor=placement.anchorAttributes??{};
  const wrap=attributes(placement.wrap??"");
  const extent=attributes(placement.extent??"");
  const horizontal=position(placement.horizontalPosition,"positionH");
  const vertical=position(placement.verticalPosition,"positionV");
  const wrapTag=/<wp:(wrap\\w+)\\b/.exec(placement.wrap??"")?.[1]??null;
  if(wrapTag==="wrapSquare"&&wrap.wrapText!=="bothSides")
    return {ok:false,error:"Square wrapping must allow text on both sides."};
  if(!["wrapSquare","wrapTopAndBottom"].includes(wrapTag))
    return {ok:false,error:"This Word floating-image wrap mode is not yet mapped."};
  if(horizontal?.relativeFrom!=="column"||horizontal.offset!==0||vertical?.relativeFrom!=="paragraph"||vertical.offset!==0)
    return {ok:false,error:"Floating image must be anchored at zero offset from the column and paragraph."};
  if(anchor.behindDoc!=="0") return {ok:false,error:"Behind-document floating images require a separate renderer."};
  const cx=Number(extent.cx),cy=Number(extent.cy);
  if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cy)||cx<=0||cy<=0)
    return {ok:false,error:"Floating image lacks valid Word extent dimensions."};
  const distance=(name)=>{
    const value=Number(anchor[name]??"0");
    return Number.isSafeInteger(value)&&value>=0?emuToPt(value):null;
  };
  const left=distance("distL"),right=distance("distR"),top=distance("distT"),bottom=distance("distB");
  if([left,right,top,bottom].some(value=>value===null)) return {ok:false,error:"Floating image text distances are invalid."};
  const indentTwips=Number(paragraphIndentation.left??0);
  if(!Number.isFinite(indentTwips)) return {ok:false,error:"Paragraph indentation cannot be resolved for floating image placement."};
  const common={
    width:pt(emuToPt(cx))+"pt",
    "margin-left":pt(-twipsToPt(indentTwips))+"pt",
    "margin-top":pt(top)+"pt",
    "margin-bottom":pt(bottom)+"pt"
  };
  const style=wrapTag==="wrapTopAndBottom"
    ? {display:"block",clear:"both",...common,"max-width":"100%",height:"auto","margin-right":"auto"}
    : {float:"left",...common,height:pt(emuToPt(cy))+"pt","margin-right":pt(right)+"pt"};
  return {ok:true,style,css:Object.entries(style).map(([key,value])=>key+":"+value).join(";")};
}
