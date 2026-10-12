"""4단원 지면 시안 빌드: QR 이미지 생성 → book.html을 PDF 2종(검토용·깨끗한 시안)으로 출력.

사용법 (unit4_2027 폴더에서):
    python -m venv .venv && .venv/bin/pip install "qrcode[pil]" playwright
    (cd tools && npm install)            # 글꼴(@fontsource) 설치
    .venv/bin/python tools/build.py

QR 링크를 바꾸려면 qr_links.json의 url만 고치고 다시 빌드하면 됩니다.
"""
import json
import pathlib

import qrcode
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def make_qr():
    links = json.loads((ROOT / "qr_links.json").read_text(encoding="utf-8"))
    out = ROOT / "assets" / "qr"
    out.mkdir(parents=True, exist_ok=True)
    for item in links:
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=1)
        qr.add_data(item["url"])
        qr.make(fit=True)
        qr.make_image(fill_color="black", back_color="white").save(out / f"{item['id']}.png")
    return links


def make_ai_jpg():
    """AI 원본 PNG(assets/ai/*.png)를 지면용 JPG로 줄여 PDF 용량을 낮춥니다."""
    from PIL import Image
    for png in (ROOT / "assets" / "ai").glob("*.png"):
        jpg = png.with_suffix(".jpg")
        if not jpg.exists() or jpg.stat().st_mtime < png.stat().st_mtime:
            Image.open(png).convert("RGB").save(jpg, quality=88, optimize=True)


def render():
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    launch = {"executable_path": CHROMIUM} if pathlib.Path(CHROMIUM).exists() else {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch)
        page = browser.new_page()
        page.goto((ROOT / "book.html").as_uri())
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(1500)
        page.pdf(path=str(out / "2027_의성이야기_4단원_수정시안_검토용.pdf"), width="420mm", height="270mm", print_background=True)
        page.evaluate("document.body.classList.add('clean')")
        page.wait_for_timeout(300)
        page.pdf(path=str(out / "2027_의성이야기_4단원_수정시안.pdf"), width="420mm", height="270mm", print_background=True)
        page.evaluate("document.body.classList.remove('clean')")
        for i, sp in enumerate(page.query_selector_all(".spread")):
            sp.screenshot(path=str(out / f"preview_{i + 1:02d}.png"))
        browser.close()


if __name__ == "__main__":
    make_qr()
    make_ai_jpg()
    render()
    print("done")
