// 교안 마크다운을 보기 좋은 화면 요소로 바꿔 주는 플러그인입니다.
//
// - ```prompt 제목      → [복사] [.txt 받기] 버튼이 달린 프롬프트 카드
// - > 💡 ... / > ⚠ ... / > 📌 ...  → 팁·주의·안내 상자
// - ### ✋ 실습 ...       → 다음 제목 전까지를 '실습 카드'로 묶음
// - 📍 로 시작하는 문단   → 메뉴 위치 표시
// - 첫 칸이 '시간'인 표   → 진행표 모양
// - /images/... /files/... 같은 절대 경로 → 사이트 기본 경로를 붙여 줌

const escapeHtml = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CALLOUTS = [
  { re: /^💡\s*/, type: 'tip', label: '도움말' },
  { re: /^⚠️?\s*/, type: 'warn', label: '주의' },
  { re: /^📌\s*/, type: 'note', label: '안내' },
];

function firstText(node) {
  if (!node) return null;
  if (node.type === 'text') return node;
  for (const c of node.children || []) {
    const t = firstText(c);
    if (t) return t;
  }
  return null;
}

function plainText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return (node.children || []).map(plainText).join('');
}

function setH(node, hName, className, extra = {}) {
  node.data = node.data || {};
  if (hName) node.data.hName = hName;
  node.data.hProperties = { ...(node.data.hProperties || {}), className, ...extra };
}

function promptCard(node) {
  const title = (node.meta || '').trim() || '예시 프롬프트';
  return {
    type: 'html',
    value:
      `<figure class="prompt-card" data-title="${escapeHtml(title)}">` +
      `<figcaption><span class="prompt-badge">프롬프트</span><span class="prompt-title">${escapeHtml(title)}</span>` +
      `<span class="prompt-actions"><button type="button" class="btn-copy">복사</button>` +
      `<button type="button" class="btn-download">.txt 받기</button></span></figcaption>` +
      `<pre class="prompt-text">${escapeHtml(node.value)}</pre></figure>`,
  };
}

function transform(node, base) {
  if ((node.type === 'image' || node.type === 'link') && typeof node.url === 'string' && /^\/(?!\/)/.test(node.url)) {
    node.url = base + node.url;
  }
  // 본문에 직접 쓴 HTML(<video src="/files/..."> 등)도 기본 경로를 붙여 줌
  if (node.type === 'html' && typeof node.value === 'string') {
    node.value = node.value.replace(/\b(src|href|poster)="\/(?!\/)/g, `$1="${base}/`);
  }

  if (node.type === 'blockquote') {
    const t = firstText(node);
    const hit = t && CALLOUTS.find((c) => c.re.test(t.value));
    if (hit) {
      t.value = t.value.replace(hit.re, '');
      setH(node, 'aside', ['callout', `callout-${hit.type}`], { 'data-label': hit.label });
    }
  }

  if (node.type === 'paragraph') {
    const t = firstText(node);
    if (t && /^📍\s*/.test(t.value) && node.children[0] === t) {
      t.value = t.value.replace(/^📍\s*/, '');
      setH(node, 'p', ['menu-path']);
    }
  }

  if (node.type === 'table') {
    const head = node.children?.[0]?.children?.[0];
    if (head && plainText(head).trim() === '시간') setH(node, null, ['schedule']);
  }

  if (!node.children) return;

  // 프롬프트 카드 바꾸기 + 실습 카드로 묶기
  const out = [];
  for (let i = 0; i < node.children.length; i++) {
    let child = node.children[i];
    if (child.type === 'code' && child.lang === 'prompt') {
      out.push(promptCard(child));
      continue;
    }
    if (child.type === 'heading' && child.depth === 3) {
      const t = firstText(child);
      if (t && /^✋\s*/.test(t.value)) {
        t.value = t.value.replace(/^✋\s*/, '');
        const group = [child];
        while (i + 1 < node.children.length) {
          const next = node.children[i + 1];
          if (next.type === 'heading' && next.depth <= 3) break;
          group.push(next);
          i++;
        }
        group.forEach((g) => g !== child && transform(g, base));
        const wrapped = group.map((g) => (g.type === 'code' && g.lang === 'prompt' ? promptCard(g) : g));
        out.push({ type: 'practice', data: { hName: 'section', hProperties: { className: ['practice'] } }, children: wrapped });
        continue;
      }
    }
    transform(child, base);
    out.push(child);
  }
  node.children = out;
}

export default function remarkPromptBlocks(options = {}) {
  const base = (options.base || '/').replace(/\/$/, '');
  return (tree) => transform(tree, base);
}
