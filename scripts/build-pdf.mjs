// 빌드된 사이트(dist)의 인쇄용 페이지(/print/교안id/)를 열어 교안 PDF를 만듭니다.
// 결과: dist/pdf/교안id.pdf  (만든 뒤 인쇄용 페이지는 지웁니다)
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist';
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(BASE)) { res.writeHead(404).end(); return; }
  path = normalize(join(DIST, path.slice(BASE.length)));
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}`;

const ids = (await readdir(join(DIST, 'print'), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
await mkdir(join(DIST, 'pdf'), { recursive: true });

const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const page = await browser.newPage();
for (const id of ids) {
  await page.goto(`${origin}${BASE}print/${id}/`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  const title = await page.title();
  await page.pdf({
    path: join(DIST, 'pdf', `${id}.pdf`),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-size:8px;color:#8a918c;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif;">
      <span>${title.replace(/[<&>]/g, '')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  console.log(`PDF 생성: pdf/${id}.pdf`);
}
await browser.close();
server.close();
await rm(join(DIST, 'print'), { recursive: true, force: true });
