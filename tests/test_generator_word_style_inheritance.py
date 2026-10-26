#!/usr/bin/env python3
"""Browser regression for Word style size inheritance without network or publication."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

GENERATOR = Path(__file__).resolve().parents[1] / "editor" / "generator.html"
NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

def test_word_size_inheritance_and_text_fidelity():
    source = GENERATOR.read_text(encoding="utf-8")
    match = re.search(r"async function restoreWordFormatting\(buffer,article\)\{.*?\n\}(?=\n\n(?:\/\/|function |let docxFile=))", source, re.S)
    assert match, "Word restoration function missing"
    function = match.group(0)
    styles = f'''<w:styles xmlns:w="{NS}">
      <w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>
      <w:style w:type="paragraph" w:styleId="Parent"><w:rPr><w:sz w:val="28"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Child"><w:basedOn w:val="Parent"/></w:style>
      <w:style w:type="character" w:styleId="Character"><w:rPr><w:sz w:val="36"/></w:rPr></w:style>
      <w:style w:type="character" w:styleId="CycleA"><w:basedOn w:val="CycleB"/></w:style>
      <w:style w:type="character" w:styleId="CycleB"><w:basedOn w:val="CycleA"/></w:style>
    </w:styles>'''
    document = f'''<w:document xmlns:w="{NS}"><w:body><w:p>
      <w:pPr><w:pStyle w:val="Child"/></w:pPr>
      <w:r><w:t>甲</w:t></w:r>
      <w:r><w:rPr><w:rStyle w:val="Character"/></w:rPr><w:t>乙</w:t></w:r>
      <w:r><w:rPr><w:rStyle w:val="Character"/><w:sz w:val="48"/></w:rPr><w:t>丙</w:t></w:r>
      <w:r><w:rPr><w:rStyle w:val="CycleA"/></w:rPr><w:t>丁</w:t></w:r>
      </w:p><w:p><w:r><w:t>Default</w:t></w:r></w:p></w:body></w:document>'''
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content('<article class="article"><p>甲乙丙丁</p><p>Default</p></article>')
        result = page.evaluate("""async ({fn,documentXml,stylesXml}) => {
          (0,eval)(fn);
          window.JSZip={loadAsync:async()=>({file:name=>({
            'word/document.xml':{async:async()=>documentXml},
            'word/styles.xml':{async:async()=>stylesXml}
          })[name]})};
          const article=document.querySelector('article');
          const before=article.textContent;
          await restoreWordFormatting(null,article);
          const blocks=[...article.querySelectorAll('p')];
          return {before,after:article.textContent,
            sizes:[...blocks[0].querySelectorAll('span')].map(x=>x.style.fontSize),
            defaultSize:blocks[1].querySelector('span')?.style.fontSize};
        }""", {"fn":function,"documentXml":document,"stylesXml":styles})
        browser.close()
    assert result["before"] == result["after"] == "甲乙丙丁Default"
    assert result["sizes"] == ["14pt","18pt","24pt","14pt"]
    assert result["defaultSize"] == "10pt"
