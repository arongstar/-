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

export const collections = { lessons, sites };
