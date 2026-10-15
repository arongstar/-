"""book.html 지면을 '편집 가능한' PPTX로 변환합니다.

브라우저에 지면을 띄운 뒤 글상자·도형·그림의 위치와 글꼴을 그대로 읽어
PowerPoint 글상자/도형/그림으로 다시 만듭니다(지면을 통째 그림으로 넣지 않음).
펼침면 1장 = 슬라이드 1장(420×270mm). 편집 메모(M 번호)는 슬라이드 노트로 들어갑니다.

사용법: .venv/bin/python tools/make_pptx.py
"""
import json
import pathlib
import re

from lxml import etree
from PIL import Image, ImageOps
from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "output"
TMP = OUT / "_pptx_assets"
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FONT = "맑은 고딕"
PX = 914400 / 96  # CSS px -> EMU

EXTRACT_JS = r"""
(spread) => {
  const S = spread.getBoundingClientRect();
  const items = [];
  const isAtomic = el => { const d = getComputedStyle(el).display; return d !== 'inline' && d !== 'contents'; };
  const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const rel = r => ({x: r.left - S.left, y: r.top - S.top, w: r.width, h: r.height});
  const parseColor = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(s => parseFloat(s)); return {r:p[0], g:p[1], b:p[2], a: p.length > 3 ? p[3] : 1}; };

  const walk = el => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    if (tag === 'svg') { const r = el.getBoundingClientRect(); if (r.width > 2 && r.height > 2) { const id = 'svg' + items.length; el.setAttribute('data-shot', id); items.push({type:'svg', id, ...rel(r)}); } return; }
    if (tag === 'img') { const r = el.getBoundingClientRect(); const ib = parseFloat(cs.borderTopWidth) || 0;
      if (ib > 2) { const bc = parseColor(cs.borderTopColor); items.push({type:'box', ...rel(r), bg: bc, grad: false, bw: 0, bc: null, onlyTop: false, dash: false, radius: parseFloat(cs.borderTopLeftRadius) || 0}); items.push({type:'img', src: el.getAttribute('src'), fit: cs.objectFit, pos: cs.objectPosition, gray: (cs.filter || '').includes('grayscale'), x: r.left - S.left + ib, y: r.top - S.top + ib, w: r.width - 2*ib, h: r.height - 2*ib}); return; }
      items.push({type:'img', src: el.getAttribute('src'), fit: cs.objectFit, pos: cs.objectPosition, gray: (cs.filter || '').includes('grayscale'), ...rel(r)}); return; }
    if (el !== spread && isAtomic(el)) {
      const bg = parseColor(cs.backgroundColor);
      const grad = (cs.backgroundImage || 'none') !== 'none';
      const bw = Math.max(parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderLeftWidth) || 0);
      const onlyTop = (parseFloat(cs.borderTopWidth) || 0) > 0.4 && (parseFloat(cs.borderLeftWidth) || 0) < 0.4 && (parseFloat(cs.borderBottomWidth) || 0) < 0.4;
      const bc = parseColor(cs.borderTopColor);
      const hasBg = (bg && bg.a > 0.05) || grad;
      const hasBorder = bw > 0.4 && cs.borderTopStyle !== 'none' && bc && bc.a > 0.05;
      if (hasBg || hasBorder) {
        const r = el.getBoundingClientRect();
        items.push({type:'box', ...rel(r), bg: bg && bg.a > 0.05 ? bg : null, grad, bw: hasBorder ? bw : 0, bc: hasBorder ? bc : null,
                    onlyTop, dash: cs.borderTopStyle === 'dashed', radius: parseFloat(cs.borderTopLeftRadius) || 0});
      }
    }
    // 이 원자 요소에 속한 글자 모으기(안쪽 원자 요소는 제외)
    if (isAtomic(el) || el === spread) {
      const runs = []; const nodes = [];
      const collect = n => {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) {
            const t = c.textContent.replace(/\s+/g, ' ');
            if (t.trim() === '' && runs.length === 0) continue;
            const p = getComputedStyle(c.parentElement);
            runs.push({t, b: parseInt(p.fontWeight) >= 600, c: parseColor(p.color), fs: parseFloat(p.fontSize), u: p.textDecorationLine.includes('underline'), jua: p.fontFamily.includes('Jua')});
            nodes.push(c);
          } else if (c.nodeType === 1) {
            if (!visible(c)) continue;
            const tg = c.tagName.toLowerCase();
            if (tg === 'br') { runs.push({br: true}); continue; }
            if (tg === 'svg' || tg === 'img' || isAtomic(c)) continue;
            collect(c);
          }
        }
      };
      collect(el);
      while (runs.length && (runs[runs.length-1].br || runs[runs.length-1].t.trim() === '')) runs.pop();
      if (nodes.length && runs.some(r => r.t && r.t.trim())) {
        const range = document.createRange(); let box = null;
        for (const n of nodes) { range.selectNodeContents(n); for (const rr of range.getClientRects()) { if (rr.width < 0.5) continue; box = box ? {l: Math.min(box.l, rr.left), t: Math.min(box.t, rr.top), r: Math.max(box.r, rr.right), b: Math.max(box.b, rr.bottom)} : {l: rr.left, t: rr.top, r: rr.right, b: rr.bottom}; } }
        if (box) {
          if (runs[0].t) runs[0].t = runs[0].t.replace(/^\s+/, '');
          const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
          items.push({type:'text', x: box.l - S.left, y: box.t - S.top, w: box.r - box.l, h: box.b - box.t, runs, align: cs.textAlign, lh: isFinite(lh) ? lh : 1.4});
        }
      }
    }
    for (const c of el.children) walk(c);
  };
  const bg = parseColor(getComputedStyle(spread).backgroundColor);
  walk(spread);
  return {w: S.width, h: S.height, bg, items};
}
"""


def rgb(c):
    return RGBColor(int(c["r"]), int(c["g"]), int(c["b"]))


def set_font(run, size_pt, bold, color, underline=False):
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.underline = underline
    if color:
        run.font.color.rgb = rgb(color)
    rpr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        el = rpr.find(qn(tag))
        if el is None:
            el = etree.SubElement(rpr, qn(tag))
        el.set("typeface", FONT)


def crop_image(src, w, h, fit, pos, gray, key):
    im = Image.open(ROOT / src)
    im = ImageOps.exif_transpose(im).convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    if gray:
        im = ImageOps.grayscale(im).convert("RGB")
    if fit == "cover" and w > 0 and h > 0:
        tw = w / h
        iw, ih = im.size
        if iw / ih > tw:
            nw = int(ih * tw)
            x0 = (iw - nw) if "right" in pos or pos.startswith("100%") else (iw - nw) // 2
            im = im.crop((x0, 0, x0 + nw, ih))
        else:
            nh = int(iw / tw)
            y0 = (ih - nh) // 2
            im = im.crop((0, y0, iw, y0 + nh))
    path = TMP / f"{key}.{'png' if im.mode == 'RGBA' else 'jpg'}"
    if im.mode == "RGBA":
        im.save(path)
    else:
        im.save(path, quality=90)
    return path, im.size


def add_picture_fit(slide, path, size, it, fit):
    x, y, w, h = it["x"], it["y"], it["w"], it["h"]
    if fit == "contain":
        iw, ih = size
        s = min(w / iw, h / ih)
        nw, nh = iw * s, ih * s
        x, y, w, h = x + (w - nw) / 2, y + (h - nh) / 2, nw, nh
    slide.shapes.add_picture(str(path), Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))


def build():
    TMP.mkdir(parents=True, exist_ok=True)
    memo, spreads = {}, []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM) if pathlib.Path(CHROMIUM).exists() else p.chromium.launch()
        page = browser.new_page(viewport={"width": 1700, "height": 1100})
        page.goto((ROOT / "book.html").as_uri())
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(1500)
        # 검토용 상태에서 펼침면별 M 번호와 메모 내용 수집
        memo = page.evaluate("""() => { const m = {}; document.querySelectorAll('.memo-page li').forEach(li => { const b = li.querySelector('b'); if (b) m[b.textContent.trim()] = li.textContent.trim(); }); return m; }""")
        mlist = page.evaluate("""() => [...document.querySelectorAll('.spread:not(.rev-only)')].map(s => [...new Set([...s.querySelectorAll('.m')].map(e => e.textContent.trim()))])""")
        page.evaluate("document.body.classList.add('clean')")
        page.wait_for_timeout(300)
        handles = page.query_selector_all(".spread:not(.rev-only)")
        for i, h in enumerate(handles):
            data = page.evaluate(EXTRACT_JS, h)
            page.add_style_tag(content="body.shotmode *{visibility:hidden!important} body.shotmode [data-shot], body.shotmode [data-shot] *, body.shotmode symbol, body.shotmode symbol *{visibility:visible!important}")
            page.evaluate("document.body.classList.add('shotmode')")
            for it in data["items"]:
                if it["type"] == "svg":
                    shot = TMP / f"s{i}_{it['id']}.png"
                    page.query_selector(f"[data-shot='{it['id']}']").screenshot(path=str(shot), omit_background=True)
                    it["file"] = str(shot)
            page.evaluate("document.body.classList.remove('shotmode'); document.querySelectorAll('[data-shot]').forEach(e => e.removeAttribute('data-shot'))")
            data["memos"] = mlist[i] if i < len(mlist) else []
            spreads.append(data)
        browser.close()

    prs = Presentation()
    W, H = spreads[0]["w"], spreads[0]["h"]
    prs.slide_width, prs.slide_height = Emu(int(W * PX)), Emu(int(H * PX))
    blank = prs.slide_layouts[6]
    for si, sp in enumerate(spreads):
        slide = prs.slides.add_slide(blank)
        if sp["bg"] and sp["bg"]["a"] > 0.05:
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = rgb(sp["bg"])
        for k, it in enumerate(sp["items"]):
            x, y, w, h = (Emu(int(it[v] * PX)) for v in ("x", "y", "w", "h"))
            if it["type"] == "box":
                if it["w"] < 1 or it["h"] < 1:
                    continue
                if it.get("onlyTop") and not it["bg"] and not it["grad"]:
                    ln = slide.shapes.add_connector(1, x, y, Emu(int((it["x"] + it["w"]) * PX)), y)
                    ln.line.color.rgb = rgb(it["bc"])
                    ln.line.width = Pt(max(0.5, it["bw"] * 0.75))
                    continue
                shape_t = MSO_SHAPE.ROUNDED_RECTANGLE if it["radius"] > 0.5 else MSO_SHAPE.RECTANGLE
                shp = slide.shapes.add_shape(shape_t, x, y, w, h)
                shp.shadow.inherit = False
                if shape_t == MSO_SHAPE.ROUNDED_RECTANGLE:
                    shp.adjustments[0] = min(0.5, it["radius"] / max(1, min(it["w"], it["h"])))
                if it["bg"]:
                    shp.fill.solid()
                    shp.fill.fore_color.rgb = rgb(it["bg"])
                elif it["grad"]:
                    shp.fill.solid()
                    shp.fill.fore_color.rgb = RGBColor(0xF6, 0xF3, 0xFB) if (it["bc"] and it["bc"]["b"] > it["bc"]["g"]) else RGBColor(0xFD, 0xF6, 0xEA)
                else:
                    shp.fill.background()
                if it["bc"]:
                    shp.line.color.rgb = rgb(it["bc"])
                    shp.line.width = Pt(max(0.5, it["bw"] * 0.75))
                    if it["dash"]:
                        shp.line.dash_style = MSO_LINE_DASH_STYLE.DASH
                else:
                    shp.line.fill.background()
                shp.text_frame.text = ""
            elif it["type"] == "img":
                path, size = crop_image(it["src"], it["w"], it["h"], it["fit"], it["pos"], it["gray"], f"i{si}_{k}")
                add_picture_fit(slide, path, size, it, it["fit"])
            elif it["type"] == "svg":
                slide.shapes.add_picture(it["file"], x, y, w, h)
            elif it["type"] == "text":
                fs_max = max((r.get("fs", 0) for r in it["runs"] if not r.get("br")), default=12)
                single = it["h"] < fs_max * it["lh"] * 1.5 and not any(r.get("br") for r in it["runs"])
                jua = any(r.get("jua") for r in it["runs"] if not r.get("br"))
                pad = (0.25 if jua else 0.02) * it["w"] + (6 if jua else 2)  # 글꼴 차이로 줄이 넘치지 않도록 여유
                tb = slide.shapes.add_textbox(Emu(int((it["x"] - (pad / 2 if it["align"] == "center" else 0)) * PX)), y, Emu(int((it["w"] + pad) * PX)), Emu(int((it["h"] + 2) * PX)))
                tf = tb.text_frame
                tf.word_wrap = not single
                tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
                tf.vertical_anchor = MSO_ANCHOR.MIDDLE if single else MSO_ANCHOR.TOP
                para = tf.paragraphs[0]
                al = {"center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT, "end": PP_ALIGN.RIGHT}.get(it["align"], PP_ALIGN.LEFT)
                para.alignment = al
                para.line_spacing = 1.0 if single else max(1.0, min(1.9, it["lh"] * 0.9))
                for r in it["runs"]:
                    if r.get("br"):
                        para = tf.add_paragraph()
                        para.alignment = al
                        para.line_spacing = max(1.0, min(1.9, it["lh"] * 0.9))
                        continue
                    run = para.add_run()
                    run.text = r["t"]
                    set_font(run, r["fs"] * 0.75, r["b"] or r["jua"], r["c"], r["u"])
        notes = [memo.get(m, m) for m in sp["memos"]]
        if notes:
            slide.notes_slide.notes_text_frame.text = "편집 메모\n" + "\n".join(notes)
    out = OUT / "2027_의성이야기_4단원_수정시안_편집용.pptx"
    prs.save(out)
    print(out)


if __name__ == "__main__":
    build()
