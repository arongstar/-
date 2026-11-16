# 표지 그림 만들기 (Codex + 사용자 ChatGPT 계정)

표지는 사용자의 캐릭터 시트(`../assets/character-ref.jpg`, 남교사 치비 캐릭터)를 참고 그림으로 넣고 Codex CLI의 그림 생성 기능으로 만듭니다. OpenAI API 키는 쓰지 않아요. 사용자의 ChatGPT 계정으로 로그인합니다.

## 1. Codex 설치·로그인 (세션마다 한 번)

작업 폴더는 스크래치패드 아래에 만듭니다(아래 `$SCRATCH`는 세션의 스크래치패드 경로).

```bash
mkdir -p "$SCRATCH/codex" && cd "$SCRATCH/codex" && npm i @openai/codex@0.169.0
npx codex login status || npx codex login --device-auth
```

- `--device-auth`를 실행하면 `https://auth.openai.com/codex/device` 주소와 1회용 코드가 나옵니다. 백그라운드로 돌려 두고, **주소와 코드를 사용자에게 알려 주어** 사용자가 직접 로그인하게 합니다. 코드는 15분 안에 써야 해요. 사용자 비밀번호·토큰을 채팅으로 받지 않습니다.
- 네트워크가 막히면 환경에 `auth.openai.com`, `chatgpt.com` 허용이 필요합니다(이 저장소 환경에는 이미 들어 있음).

## 2. 그림 한 장 만들기

```bash
d="$SCRATCH/codex/<id>" && mkdir -p "$d" && cp <저장소>/.claude/skills/lesson-publish/assets/character-ref.jpg "$d/"
# prompt.txt 작성 (아래 틀)
cd "$d" && npx codex exec --skip-git-repo-check -C "$d" -s workspace-write --json -o last.txt -i character-ref.jpg - < prompt.txt > run.jsonl
```

- `-i`가 뒤에 오는 글자를 그림 파일로 먹어 버리므로, 프롬프트는 반드시 **`-`(표준입력)** 으로 넘깁니다.
- 몇 분 걸립니다. 끝나면 `cover.png`가 생겼는지 확인하고, Read 도구로 그림을 직접 봅니다. 글자가 들어갔거나 캐릭터가 달라졌으면 다시 만듭니다.

### prompt.txt 틀

```text
The attached image is a character sheet of ONE character: a Korean male elementary school teacher drawn as a cute chibi illustration (big head, dark brown fluffy hair with a center part, round dark eyes, rosy cheeks, soft purple-brown outlines, colored-pencil-like texture). Use your built-in image generation tool, passing the attached image as the reference image, to create ONE image and save the generated PNG into the current directory as cover.png (copy it from wherever the tool stores it). Do not draw anything with code.

Rules:
- The teacher must clearly be the SAME character as in the reference: same face, hairstyle, chibi proportions, drawing style and colored-pencil texture. Only clothes, expression and pose change.
- Absolutely no text, letters, numbers or logos anywhere.
- Landscape 16:9, <주제에 맞는 색 2가지> accents with soft cream background, plenty of empty space.

Scene: <교안 주제에 맞는 장면 — 옷차림, 표정, 동작, 소품, 배경을 구체적으로. 학생이 나오면 "cute chibi students seen from behind or side">
```

실제 서비스 로고·상표는 그리지 않게 하고(규칙에 no logos), 주제는 소품과 장면으로 나타냅니다.

## 3. 사이트에 넣기

가로 최대 1400px JPG로 줄여 저장합니다.

```bash
python3 -c "
from PIL import Image
im = Image.open('cover.png').convert('RGB'); im.thumbnail((1400, 1400))
im.save('<저장소>/public/images/covers/<id>.jpg', quality=85, optimize=True)"
```

교안 머리 정보에 `cover: /images/covers/<id>.jpg`를 넣습니다.

## Codex를 못 쓸 때

로그인이 안 되거나 사용자가 원하지 않으면 표지 없이 배포해도 됩니다(`cover`를 빼면 그림 없는 머리로 보여요). 나중에 그림만 추가할 수 있다고 알려 줍니다.
