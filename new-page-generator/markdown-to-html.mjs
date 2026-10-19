// Conservative Markdown adapter for page-generator source files.
// Supports a deliberately small CommonMark-like subset and rejects ambiguous constructs.
// It emits escaped HTML; raw HTML is never passed through.
const escapeHtml = value => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
function safeUrl(value, image=false) {
  const url=value.trim();
  if(!url || /[\u0000-\u0020\u007f]/.test(url) || url.startsWith("//")) return false;
  const scheme=/^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  return scheme ? (image ? ["https"].includes(scheme) : ["http","https","mailto","tel"].includes(scheme)) : !url.startsWith("\\");
}
function inline(source, errors, line) {
  // Raw HTML is rejected before escaping so it cannot be mistaken for Markdown.
  if(/<\/?[A-Za-z][^>]*>/.test(source)) errors.push(`Line ${line}: raw HTML is unsupported in Markdown input.`);
  let text=escapeHtml(source);
  const code=[];
  text=text.replace(/`([^`\n]+)`/g,(_,body)=>{const token="@@CODE"+code.length+"@@";code.push("<code>"+body+"</code>");return token;});
  // Links and images are parsed from original source, not escaped markup.
  const tokens=[];
  const tokenise=(html)=>{const key="@@TOKEN"+tokens.length+"@@";tokens.push(html);return key;};
  const raw=source.replace(/!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g,(match,alt,imageUrl,label,linkUrl)=>{
    const isImage=match.startsWith("!");
    const url=(isImage?imageUrl:linkUrl).trim().replace(/^<|>$/g,"");
    if(!safeUrl(url,isImage)){errors.push(`Line ${line}: unsafe or unsupported Markdown ${isImage?"image":"link"} URL.`);return escapeHtml(match);}
    const titleMatch=/^(.*?)(?:\s+["']([^"']*)["'])?$/.exec(url);
    const cleanUrl=titleMatch?.[1]??url, title=titleMatch?.[2];
    const escapedUrl=escapeHtml(cleanUrl);
    return tokenise(isImage ? `<img src="${escapedUrl}" alt="${escapeHtml(alt)}">` : `<a href="${escapedUrl}"${title? ` title="${escapeHtml(title)}"`:""}>${escapeHtml(label)}</a>`);
  });
  text=escapeHtml(raw);
  text=text.replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_\n]+)__/g,"<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g,"<em>$1</em>").replace(/_([^_\n]+)_/g,"<em>$1</em>").replace(/~~([^~\n]+)~~/g,"<s>$1</s>");
  text=text.replace(/@@CODE(\d+)@@/g,(_,i)=>code[Number(i)]??"");
  text=text.replace(/@@TOKEN(\d+)@@/g,(_,i)=>tokens[Number(i)]??"");
  // The simple inline grammar intentionally rejects reference-style syntax and
  // unresolved Markdown control characters instead of silently changing meaning.
  if(/(^|\s)\[[^\]]+\]\[[^\]]*\]/.test(source) || /^ {0,3}\[[^\]]+\]:/.test(source)) errors.push(`Line ${line}: reference-style Markdown links are unsupported.`);
  return text;
}
export function markdownToHtml(markdown) {
  const errors=[];
  if(typeof markdown!=="string" || !markdown.trim()) return {ok:false,errors:["Empty Markdown source."],html:""};
  if(markdown.includes("\u0000")) return {ok:false,errors:["Markdown contains a NUL character."],html:""};
  const lines=markdown.replace(/\r\n?/g,"\n").split("\n");
  const output=[];
  let paragraph=[], listType=null, listItems=[], quote=[];
  const flushParagraph=()=>{if(paragraph.length){output.push("<p>"+inline(paragraph.join("\n"),errors,paragraph[0].line).replace(/\n/g,"\n")+"</p>");paragraph=[];}};
  const flushList=()=>{if(listItems.length){output.push("<"+listType+">"+listItems.map(item=>"<li>"+inline(item.text,errors,item.line)+"</li>").join("")+"</"+listType+">");listType=null;listItems=[];}};
  const flushQuote=()=>{if(quote.length){output.push("<blockquote>"+quote.map(item=>"<p>"+inline(item.text,errors,item.line)+"</p>").join("")+"</blockquote>");quote=[];}};
  for(let i=0;i<lines.length;i++){
    const raw=lines[i], line=i+1;
    if(!raw.trim()){flushParagraph();flushList();flushQuote();continue;}
    if(/^\s{0,3}(```|~~~)/.test(raw)){errors.push(`Line ${line}: fenced code blocks require a dedicated code review and are not supported yet.`);flushParagraph();flushList();flushQuote();continue;}
    const heading=/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    const ordered=/^\s{0,3}(\d+)[.)]\s+(.+)$/.exec(raw);
    const unordered=/^\s{0,3}([-+*])\s+(.+)$/.exec(raw);
    const quoteLine=/^\s{0,3}>\s?(.*)$/.exec(raw);
    if(heading){flushParagraph();flushList();flushQuote();const level=heading[1].length;output.push(`<h${level}>${inline(heading[2],errors,line)}</h${level}>`);continue;}
    if(ordered||unordered){
      flushParagraph();flushQuote();
      const type=ordered?"ol":"ul";
      if(listType && listType!==type) flushList();
      listType=type;listItems.push({text:(ordered??unordered)[2],line});
      if((ordered && Number(ordered[1])!==listItems.length && listItems.length===1 && Number(ordered[1])!==1)) {
        // Preserve a non-default start marker explicitly.
        listType="ol";
      }
      continue;
    }
    if(quoteLine){flushParagraph();flushList();quote.push({text:quoteLine[1],line});continue;}
    if(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(raw)){errors.push(`Line ${line}: thematic breaks are not supported in the current Markdown subset.`);flushParagraph();flushList();flushQuote();continue;}
    if(/^\s{0,3}(<|\|)/.test(raw) || /^\s{0,3}[*+-]\s*\[[ xX]\]/.test(raw)){errors.push(`Line ${line}: raw HTML, tables, and task-list syntax are not supported in the current Markdown subset.`);flushParagraph();flushList();flushQuote();continue;}
    flushList();flushQuote();paragraph.push({text:raw,line});
  }
  flushParagraph();flushList();flushQuote();
  const html=output.join("\n");
  return {ok:errors.length===0,errors,html:errors.length?"":html};
}
