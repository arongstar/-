// Index.html 을 브라우저에 띄우고 google.script.run 을 가짜 서버(gas-mock)에 연결
const fs = require('fs');
const SHIM = `<script>
window.google = { script: { run: (function make(ok, ng) {
  return new Proxy({}, { get(_, k) {
    if (k === 'withSuccessHandler') return (f) => make(f, ng);
    if (k === 'withFailureHandler') return (f) => make(ok, f);
    return (...args) => window.__gas(k, JSON.stringify(args)).then((r) => { r = JSON.parse(r); r.error ? ng && ng(new Error(r.error)) : ok && ok(r.value); });
  } });
})() } };
</script>`;
async function open(browser, g, htmlPath, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('dialog', (d) => d.accept());
  await page.exposeFunction('__gas', (fn, args) => {
    try { return JSON.stringify({ value: g.call(fn, ...JSON.parse(args)) }); }
    catch (e) { return JSON.stringify({ error: e.message }); }
  });
  const html = fs.readFileSync(htmlPath, 'utf8').replace('<head>', '<head>' + SHIM);
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return page;
}
module.exports = { open };
