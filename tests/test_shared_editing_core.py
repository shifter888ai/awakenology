#!/usr/bin/env python3
"""Focused browser regression tests for the shared editing core.

Run: python -m pytest tests/test_shared_editing_core.py
Requires pytest and Playwright Chromium. No network or published pages used.
"""
from pathlib import Path
import pytest
from playwright.sync_api import sync_playwright

CORE = Path(__file__).resolve().parents[1] / "editor" / "shared-editing-core.js"

@pytest.fixture(scope="module")
def page():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        yield page
        browser.close()

def run(page, markup, start, end, size):
    page.set_content('<article class="article">' + markup + '</article>')
    page.add_script_tag(content=CORE.read_text(encoding="utf-8"))
    return page.evaluate("""({start,end,size}) => {
      const article=document.querySelector('article');
      const before=article.textContent;
      const text=[];const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(node.data.length)text.push(node);
      const r=document.createRange();
      r.setStart(text[start[0]],start[1]);r.setEnd(text[end[0]],end[1]);
      const selection=getSelection();selection.removeAllRanges();selection.addRange(r);
      let error=null;
      try{AwakenologyEditingCore.applyFontSize(document,selection,size,article)}
      catch(e){error=e.message}
      return {before,after:article.textContent,html:article.innerHTML,error};
    }""", {"start": start, "end": end, "size": size})

def test_partial_reset_preserves_other_styles(page):
    result=run(page,'<p><span style="font-size: 24pt; color: red">abcdef</span></p>',[0,2],[0,4],"")
    assert result["error"] is None
    assert result["after"] == result["before"] == "abcdef"
    assert 'color: red' in result["html"]
    assert result["html"].count('font-size: 24pt') == 2

def test_apply_arbitrary_size(page):
    result=run(page,'<p>abcdef</p>',[0,1],[0,5],"18")
    assert result["error"] is None
    assert result["after"] == "abcdef"
    assert "font-size: 18pt" in result["html"]

def test_cross_paragraph_selection_never_wraps_blocks(page):
    result=run(page,'<p>abc</p><p>def</p>',[0,1],[1,2],"16")
    assert result["error"] is None
    assert result["after"] == "abcdef"
    assert page.locator('span p').count() == 0

def test_nested_reset_refuses_without_changes(page):
    result=run(page,'<p><span style="font-size:24pt"><span style="font-size:12pt">abc</span></span></p>',[0,0],[0,3],"")
    assert result["error"] is not None
    assert result["after"] == result["before"]
    assert result["html"].count('font-size:') == 2

def test_collapsed_selection_refuses(page):
    result=run(page,'<p>abc</p>',[0,1],[0,1],"20")
    assert result["error"] is not None
    assert result["after"] == "abc"


def test_cross_inline_selection_preserves_unselected_formatting(page):
    result = run(page, '<p><strong>abc</strong><em>def</em></p>', [0, 1], [1, 2], "12")
    assert result["error"] is None
    assert result["before"] == result["after"] == "abcdef"
    assert "<strong>a</strong>" in result["html"]
    assert "<em>f</em>" in result["html"]
    assert result["html"].count("font-size: 12pt") == 2

def test_repeated_apply_and_reset_preserves_text_and_dom_validity(page):
    result = run(page, '<p>abcdef</p>', [0, 1], [0, 5], "24")
    assert result["error"] is None
    assert result["before"] == result["after"] == "abcdef"
    result = run(page, result["html"], [0, 1], [0, 5], "")
    assert result["error"] is None
    assert result["before"] == result["after"] == "abcdef"
    assert "font-size:" not in result["html"]
    assert page.locator("span p").count() == 0

def test_invalid_font_size_refuses_without_changes(page):
    result = run(page, '<p>abcdef</p>', [0, 1], [0, 5], "999")
    assert result["error"] is not None
    assert result["before"] == result["after"] == "abcdef"
    assert "font-size:" not in result["html"]
