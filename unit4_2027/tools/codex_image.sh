#!/usr/bin/env bash
# Codex CLI로 ai_image_prompts.json의 이미지를 만들어 assets/ai/<ID>.png로 저장합니다.
# 사용법: tools/codex_image.sh AI-01 [AI-02 ...]   (인자가 없으면 전체)
# 필요: OPENAI_API_KEY 환경 변수(또는 codex login 완료), api.openai.com 접속 허용
set -euo pipefail
cd "$(dirname "$0")/.."
if ! codex login status >/dev/null 2>&1; then
  if [ -n "${OPENAI_API_KEY:-}" ]; then printenv OPENAI_API_KEY | codex login --with-api-key >/dev/null
  else echo "Codex 로그인이 필요합니다: OPENAI_API_KEY를 환경 설정에 추가하세요." >&2; exit 1; fi
fi
ids=("$@"); [ ${#ids[@]} -eq 0 ] && mapfile -t ids < <(python3 -c "import json;[print(i['id']) for i in json.load(open('ai_image_prompts.json'))['items']]")
for id in "${ids[@]}"; do
  read -r -d '' prompt < <(python3 - "$id" <<'PY'
import json,sys
d=json.load(open('ai_image_prompts.json')); it=next(i for i in d['items'] if i['id']==sys.argv[1])
print(f"{it['prompt']} {d['style']}\nSIZE={it['size']}")
PY
) || true
  size=${prompt##*SIZE=}; body=${prompt%SIZE=*}
  echo "▶ $id 생성 중 ($size)"
  codex exec --enable image_generation --skip-git-repo-check -s workspace-write \
    "Use your image generation tool to create ONE image (size ${size}) from this prompt, then save the PNG file exactly at assets/ai/${id}.png in the current directory. Prompt: ${body}"
  if [ ! -f "assets/ai/${id}.png" ]; then
    latest=$(find ~/.codex -name '*.png' -newer ai_image_prompts.json -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    [ -n "$latest" ] && cp "$latest" "assets/ai/${id}.png"
  fi
  [ -f "assets/ai/${id}.png" ] && echo "  저장: assets/ai/${id}.png" || echo "  ✗ $id 저장 실패" >&2
done
