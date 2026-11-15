// 마크다운에서 ```prompt 제목 ... ``` 으로 쓴 블록을
// "복사 / 다운로드" 버튼이 달린 프롬프트 카드로 바꿔 주는 플러그인입니다.
const escapeHtml = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function transform(node) {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type === 'code' && child.lang === 'prompt') {
      const title = (child.meta || '').trim() || '예시 프롬프트';
      return {
        type: 'html',
        value:
          `<figure class="prompt-card" data-title="${escapeHtml(title)}">` +
          `<figcaption><span class="prompt-badge">프롬프트</span><span class="prompt-title">${escapeHtml(title)}</span>` +
          `<span class="prompt-actions"><button type="button" class="btn-copy">복사</button>` +
          `<button type="button" class="btn-download">.txt 받기</button></span></figcaption>` +
          `<pre class="prompt-text">${escapeHtml(child.value)}</pre></figure>`,
      };
    }
    transform(child);
    return child;
  });
}

export default function remarkPromptBlocks() {
  return (tree) => transform(tree);
}
