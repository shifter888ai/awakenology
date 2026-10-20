import { parse } from "parse5";

const toDom = (node, parentNode=null) => {
  if (node.nodeName === "#text") return {nodeType:3,textContent:node.value??"",parentNode};
  if (node.nodeName === "#comment") return {nodeType:8,textContent:node.data??"",parentNode};
  const element = {
    nodeType:node.tagName?1:9,
    ...(node.tagName?{tagName:node.tagName.toUpperCase(),attributes:(node.attrs??[]).map(item=>({name:item.name,value:item.value}))}:{}),
    textContent:"",
    parentNode,
    childNodes:[],
    getAttribute(name){return this.attributes?.find(item=>item.name.toLowerCase()===name.toLowerCase())?.value??null;}
  };
  element.childNodes=(node.childNodes??[]).map(child=>toDom(child,element));
  return element;
};

export const parse5DomParser = Object.freeze({
  parseFromString(html) {
    const document=parse(String(html??""));
    const htmlNode=document.childNodes.find(node=>node.tagName==="html");
    const head=htmlNode?.childNodes.find(node=>node.tagName==="head");
    const body=htmlNode?.childNodes.find(node=>node.tagName==="body");
    return {head:toDom(head??{nodeName:"#document-fragment",childNodes:[]}),body:toDom(body??{nodeName:"#document-fragment",childNodes:[]})};
  }
});
