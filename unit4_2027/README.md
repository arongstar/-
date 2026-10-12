# 의성 이야기 4단원 「옛날과 오늘날의 생활 모습」 2027학년도 수정 시안

2026학년도 교과서(46~61쪽)를 2022 개정 사회과 교육과정 [4사04-01]~[4사04-03]에 맞춰 고친 지면 시안입니다.

## 결과물
- `output/2027_의성이야기_4단원_수정시안.pdf` — 깨끗한 시안
- `output/2027_의성이야기_4단원_수정시안_검토용.pdf` — 수정 근거 표시(빨간 M 번호)와 마지막 쪽 「편집 메모」 포함

## 지면의 표시
- 주황 빗금 칸: 실제 장소라 **현장 촬영**이 필요한 사진(AI로 만들지 않음)
- 보라 빗금 칸: **AI 삽화 예정** — `ai_image_prompts.json`의 AI-01~07
- 빨간 M 번호: 검토용 PDF 마지막 쪽 편집 메모 번호

## 진행 상황 (2026. 10. 12.)
- QR 12개 점검 완료: 7개가 네이버 '비활성 QR'로 끊겨 있어 관련 사이트로 교체, 의성장날 오연결 수정, 화상영어는 접속 불가로 AI 삽화로 대체. 모든 QR을 직접 주소로 다시 만듦(`qr_links.json`).
- AI 삽화 8장(AI-01~08) Codex로 생성·삽입 완료(`assets/ai/`).

## 남은 작업과 방법
1. **QR 접속 확인** — 2026년판 QR 12개 주소는 `qr_links.json`에 있습니다. 안 열리는 링크는 `url`을 새 주소로 바꾸고 다시 빌드하면 새 QR이 들어갑니다.
2. **AI 삽화 생성(Codex)** — `tools/codex_image.sh` (OPENAI_API_KEY와 api.openai.com 접속 필요). 결과는 `assets/ai/AI-xx.png`에 저장되고, 다시 빌드하면 자리 표시가 그림으로 바뀌며 "AI로 만든 그림" 표시가 붙습니다.
3. **현장 사진** — 주황 칸 자리에 맞는 사진을 `assets/photo/`에 넣고 `book.html`의 해당 칸을 `<img>`로 바꿉니다.

## 다시 빌드하기
```
python -m venv .venv && .venv/bin/pip install "qrcode[pil]" playwright
(cd tools && npm install)
.venv/bin/python tools/build.py
```
