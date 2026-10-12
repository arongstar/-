"""검토 의견서(docx)를 한글 문서(hwpx)로 옮깁니다.

사용법: .venv/bin/python tools/make_hwpx.py <입력.docx> <출력.hwpx>
문단·제목·굵은 글씨·빨간 글씨·표(머리행 색)를 그대로 옮기고, 용지는 A4 가로로 맞춥니다.
"""
import sys

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph
from hwpx import HwpxDocument

FONT = "맑은 고딕"


def runs_of(par):
    for r in par.runs:
        if not r.text:
            continue
        color = None
        if r.font.color is not None and r.font.color.rgb is not None:
            color = "#" + str(r.font.color.rgb)
        yield r.text, bool(r.bold), color, (r.font.size.pt if r.font.size else None)


def write_paragraph(doc, par, size=None, bullet=False):
    p = doc.add_paragraph("", include_run=False)
    if bullet:
        p.add_run("• ", font=FONT, size=size or 10)
    for text, bold, color, sz in runs_of(par):
        p.add_run(text, bold=bold, color=color, font=FONT, size=size or sz or 10)
    return p


def cell_fill(cell):
    tcPr = cell._tc.tcPr
    if tcPr is None:
        return None
    for el in tcPr.iter():
        if el.tag.endswith("}shd"):
            fill = el.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill")
            if fill and fill not in ("auto", "FFFFFF"):
                return "#" + fill
    return None


def write_table(doc, tbl, total_mm=267):
    rows, cols = len(tbl.rows), len(tbl.columns)
    widths = []
    for c in tbl.columns:
        try:
            widths.append(c.width or 1)
        except Exception:
            widths.append(1)
    t = doc.add_table(rows, cols, width=int(total_mm * 283.46))
    t.set_column_widths(widths)
    for ri, row in enumerate(tbl.rows):
        for ci, cell in enumerate(row.cells):
            hc = t.cell(ri, ci)
            # 기본 문단 비우고 문단별로 채우기
            first = True
            for par in cell.paragraphs:
                runs = list(runs_of(par))
                if not runs:
                    continue
                hp = hc.paragraphs[0] if first and hc.paragraphs else hc.add_paragraph("")
                if first:
                    hp.clear_text()
                first = False
                for text, bold, color, sz in runs:
                    hp.add_run(text, bold=bold or ri == 0, color=color, font=FONT, size=9)
            fill = cell_fill(cell)
            if fill:
                t.set_cell_shading(ri, ci, fill)
    doc.add_paragraph("")


def main(src, dst):
    d = docx.Document(src)
    doc = HwpxDocument.new()
    doc.set_page_setup(paper_size="A4", orientation="landscape", margins_mm={"left": 15, "right": 15, "top": 15, "bottom": 15})
    body = d.element.body
    for child in body.iterchildren():
        tag = child.tag.split("}")[1]
        if tag == "p":
            par = Paragraph(child, d)
            style = (par.style.name or "").lower() if par.style is not None else ""
            text = par.text.strip()
            if not text:
                continue
            if style.startswith("heading 1"):
                p = doc.add_paragraph("", include_run=False)
                p.add_run(text, bold=True, color="#1F3864", font=FONT, size=15)
            elif style.startswith("heading 2"):
                p = doc.add_paragraph("", include_run=False)
                p.add_run(text, bold=True, color="#2E5597", font=FONT, size=12)
            else:
                is_bullet = par._p.pPr is not None and par._p.pPr.numPr is not None
                write_paragraph(doc, par, bullet=is_bullet)
        elif tag == "tbl":
            write_table(doc, Table(child, d))
    doc.save_to_path(dst)
    print(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
