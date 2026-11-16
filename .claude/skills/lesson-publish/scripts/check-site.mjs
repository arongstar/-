// 빌드된 사이트(dist)를 훑어 교안 배포 전에 자주 생기는 문제를 찾습니다.
//
// 사용법 (저장소 맨 위에서):
//   BASE_PATH=/-/ npm run build
//   node .claude/skills/lesson-publish/scripts/check-site.mjs [교안id ...]
//   교안 id를 주면 그 교안만, 안 주면 전부 확인합니다.
//   --names 이름1,이름2 를 붙이면 공개 화면에 그 이름이 나오는지도 봅니다.
//
// 확인하는 것
//   1) 취소선(<del>) — '3~6학년'처럼 물결표가 취소선으로 바뀐 곳
//   2) 사이트 안 링크·그림·자료(/files, /images)가 실제로 dist 안에 있는지
//   3) 교안 머리 정보의 materials 파일, sites id가 있는지
//   4) 렌더링되지 않은 마크다운 흔적 (**글자**, ```prompt)
//   5) 강사 이름·소속(그리고 --names로 준 이름)이 공개 화면(PDF용 print 폴더 빼고)에 나오는지
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
const BASE = (process.env.BASE_PATH || '/-/').replace(/\/?$/, '/');
const argv = process.argv.slice(2);
const namesIdx = argv.indexOf('--names');
const extraNames = namesIdx >= 0 ? (argv[namesIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : [];
const only = argv.filter((a, i) => !a.startsWith('--') && !(namesIdx >= 0 && i === namesIdx + 1));

const problems = [];
const warn = (where, msg) => problems.push(`✗ ${where}: ${msg}`);
const exists = (p) => stat(p).then(() => true, () => false);

async function walk(dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

if (!(await exists(DIST))) {
  console.error('dist 폴더가 없어요. 먼저 BASE_PATH=/-/ npm run build 를 실행하세요.');
  process.exit(2);
}

// 강사 정보
const cfg = await readFile('src/site.config.ts', 'utf8');
const instructorName = cfg.match(/name:\s*'([^']+)'/)?.[1];
const affiliation = cfg.match(/affiliation:\s*'([^']+)'/)?.[1];
const secretNames = [instructorName, affiliation, ...extraNames].filter(Boolean);

// 사이트 id 목록
const sitesYaml = await readFile('src/data/sites.yaml', 'utf8');
const siteIds = new Set([...sitesYaml.matchAll(/^- id:\s*(\S+)/gm)].map((m) => m[1]));

// 교안 원본 확인
const lessonDir = 'src/content/lessons';
const lessonFiles = (await readdir(lessonDir)).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
let checkedLessons = 0;
for (const f of lessonFiles) {
  const id = f.replace(/\.md$/, '');
  if (only.length && !only.includes(id)) continue;
  checkedLessons++;
  const src = await readFile(join(lessonDir, f), 'utf8');
  const fm = src.split(/^---$/m)[1] || '';
  if (/^draft:\s*true/m.test(fm)) { console.log(`· ${id}: draft: true (숨김) — 건너뜀`); continue; }
  for (const m of fm.matchAll(/file:\s*(\/files\/\S+)/g)) {
    if (!(await exists(join('public', decodeURI(m[1]))))) warn(id, `자료 파일이 없음 ${m[1]}`);
  }
  const cover = fm.match(/^cover:\s*(\S+)/m)?.[1];
  if (cover && !(await exists(join('public', cover)))) warn(id, `표지 그림이 없음 ${cover}`);
  const sites = fm.match(/^sites:\s*\[([^\]]*)\]/m)?.[1];
  for (const s of (sites || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    if (!siteIds.has(s)) warn(id, `sites.yaml에 없는 사이트 id "${s}"`);
  }
  for (const m of src.matchAll(/\]\((\/(?:images|files)\/[^)\s]+)\)/g)) {
    if (!(await exists(join('public', decodeURI(m[1]))))) warn(id, `본문 링크 파일이 없음 ${m[1]}`);
  }
  const html = join(DIST, 'lessons', id, 'index.html');
  if (!(await exists(html))) { warn(id, '빌드 결과 페이지가 없음 (빌드 실패 또는 draft)'); continue; }
  const page = await readFile(html, 'utf8');
  const body = page.split('id="lesson-body"')[1] || page;
  const dels = (body.match(/<del>/g) || []).length;
  if (dels) warn(id, `취소선 ${dels}곳 — 물결표(~)를 확인하세요`);
  const text = body.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '').replace(/<[^>]+>/g, '');
  const stars = text.match(/\*\*[^*\n]{1,40}\*\*/g);
  if (stars) warn(id, `굵게가 안 된 곳 ${stars.length}곳 (예: ${stars[0]}) — 닫는 ** 바로 뒤에 조사가 붙으면 생겨요`);
  if (/```prompt/.test(body)) warn(id, '프롬프트 카드로 안 바뀐 ```prompt 블록');
}

// 공개 화면 전체: 링크·이름 노출
const files = (await walk(DIST)).filter((p) => p.endsWith('.html') && !p.startsWith(join(DIST, 'print') + '/'));
for (const p of files) {
  const html = await readFile(p, 'utf8');
  const where = p.slice(DIST.length + 1);
  for (const n of secretNames) {
    if (html.includes(n)) warn(where, `공개 화면에 "${n}" 이(가) 보여요 (PDF 표지에만 있어야 해요)`);
  }
  for (const m of html.matchAll(/(?:href|src)="([^"#?]+)/g)) {
    const u = m[1];
    if (!u.startsWith(BASE) || u.startsWith(BASE + 'pdf/')) continue;
    let rel = decodeURI(u.slice(BASE.length));
    let target = join(DIST, rel);
    if (rel === '' || rel.endsWith('/')) target = join(target, 'index.html');
    else if (!/\.[a-z0-9]+$/i.test(rel)) target = join(target, 'index.html');
    if (!(await exists(target))) warn(where, `깨진 링크 ${u}`);
  }
}

console.log(`교안 ${checkedLessons}개, 공개 페이지 ${files.length}개 확인`);
if (problems.length) {
  console.log([...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log('✓ 문제 없음');
