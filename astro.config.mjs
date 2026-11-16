// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkGfm from 'remark-gfm';
import remarkPromptBlocks from './src/lib/remark-prompt-blocks.mjs';

// GitHub Actions에서 배포할 때 SITE_URL / BASE_PATH 가 자동으로 채워집니다.
// (직접 도메인을 연결하면 SITE_URL만 바꾸고 BASE_PATH는 비워 두면 됩니다.)
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  markdown: {
    processor: unified({
      syntaxHighlight: false,
      // 표·자동 링크 등은 그대로 쓰되, '3~6학년'처럼 물결표 하나가 취소선이 되지 않게 함 (~~두 개~~만 취소선)
      gfm: false,
      remarkPlugins: [
        [remarkGfm, { singleTilde: false }],
        [remarkPromptBlocks, { base: process.env.BASE_PATH || '/' }],
      ],
    }),
  },
});
