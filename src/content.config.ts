import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

// 교안: src/content/lessons 폴더의 .md 파일 하나가 교안 하나입니다.
// 파일 이름이 _ 로 시작하면(예: _템플릿.md) 사이트에 나오지 않습니다.
const lessons = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().default(''),
    date: z.coerce.date(),
    audience: z.string().default('초등 교사'),
    duration: z.string().optional(),
    // 목록 카드와 교안 머리에 보일 대표 그림 (public/images 아래 경로)
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    // 다운로드 자료: file 은 public/files 아래 경로 또는 외부 링크(구글 드라이브 등)
    materials: z
      .array(
        z.object({
          title: z.string(),
          file: z.string(),
          description: z.string().optional(),
        }),
      )
      .default([]),
    // 이 교안에서 소개하는 사이트 (src/data/sites.yaml 의 id)
    sites: z.array(reference('sites')).default([]),
    draft: z.boolean().default(false),
  }),
});

// 사이트 모음: src/data/sites.yaml
const sites = defineCollection({
  loader: file('src/data/sites.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
    category: z.string(),
    description: z.string(),
    use: z.enum(['교사용', '학생 활동 가능']).default('교사용'),
    note: z.string().optional(),
  }),
});

// 발표 슬라이드: src/content/decks/<교안id>.yaml
// 교안 하나에 슬라이드 묶음 하나. 표지·강사 소개(PDF만)·마지막 인사 장은 자동으로 붙습니다.
const item = z.union([z.string(), z.object({ title: z.string(), text: z.string().optional() })]);
const note = z.object({ title: z.string().optional(), text: z.string().optional() }).optional();
const common = { tag: z.string().optional(), title: z.string().default(''), note };
const slide = z.discriminatedUnion('type', [
  // 연수 안내: 온라인 교안 QR + 사이트에 있는 것 + 오늘 필요한 것
  z.object({ type: z.literal('guide'), ...common, have: z.array(z.string()), need: z.array(item) }),
  // 오늘의 흐름: 칸(1부 앞/뒤, 2부…)마다 번호 목록
  z.object({
    type: z.literal('flow'), ...common,
    columns: z.array(z.object({ label: z.string(), title: z.string(), items: z.array(z.string()) })),
  }),
  // 부 나누기 장
  z.object({
    type: z.literal('section'), ...common, part: z.string(), lead: z.string().optional(),
    items: z.array(z.string()).default([]), image: z.string().optional(),
  }),
  // 1 → 2 → 3 → 4 단계 카드
  z.object({ type: z.literal('steps'), ...common, steps: z.array(item) }),
  // 번호 목록 (+ 왼쪽 그림)
  z.object({
    type: z.literal('list'), ...common, image: z.string().optional(), caption: z.string().optional(), items: z.array(item),
  }),
  // 나란히 비교 (그림 칸 또는 목록 칸)
  z.object({
    type: z.literal('compare'), ...common,
    columns: z.array(
      z.object({
        title: z.string().optional(), image: z.string().optional(), caption: z.string().optional(),
        items: z.array(z.string()).default([]),
      }),
    ),
  }),
  // 한 장 정리 표
  z.object({ type: z.literal('table'), ...common, head: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  // 이렇게 시켜 보기 (짧은 프롬프트)
  z.object({ type: z.literal('prompts'), ...common, items: z.array(z.object({ title: z.string(), text: z.string() })) }),
  // 퀴즈: 발표 화면에서는 '다음'을 한 번 누르면 정답이 보임
  z.object({
    type: z.literal('quiz'), ...common,
    options: z.array(z.object({ label: z.string(), title: z.string(), text: z.string().optional() })),
    answer: z.object({ title: z.string(), text: z.string().optional() }).optional(),
  }),
  // 쉬는 시간
  z.object({ type: z.literal('break'), ...common, text: z.string().optional(), image: z.string().optional() }),
]);
const decks = defineCollection({
  loader: glob({ pattern: '**/[^_]*.yaml', base: './src/content/decks' }),
  schema: z.object({
    lesson: reference('lessons'),
    badge: z.string().default('디지털·AI 교원 연수'),
    title: z.string(),
    parts: z.array(z.string()).default([]),
    cover: z.string().optional(),
    thanks: z.string().optional(),
    slides: z.array(slide),
  }),
});

export const collections = { lessons, sites, decks };
