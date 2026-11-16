// E. 퀴즈 앱 화면 테스트 + 교안용 화면 캡처
// 사용: node ui-E.cjs <캡처 저장 폴더>
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const { load } = require('./gas-mock.cjs');
const { open } = require('./ui-harness.cjs');

(async () => {
  const out = process.argv[2] || __dirname;
  const g = load(__dirname + '/../E-quiz/Code.gs');
  g.call('setup');
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } });
  const page = await open(browser, g, __dirname + '/../E-quiz/Index.html', { width: 820, height: 1000 });
  const shot = (name) => page.screenshot({ path: path.join(out, name) });

  await page.waitForSelector('#nums button');
  assert.equal(await page.locator('#nums button').count(), 24);
  assert.equal(await page.isDisabled('#start'), true);
  await page.click('#nums button:nth-child(7)');
  await shot('quiz-number.png');
  await page.click('#start');

  const pick = [1, 2, 2, 1, 2]; // 4번 문제는 일부러 틀림
  for (let i = 0; i < pick.length; i++) {
    assert.equal(await page.isDisabled('#next'), true, '답을 고르기 전에는 다음이 꺼져 있어야 함');
    await page.click(`#choices .choice[data-i="${pick[i]}"]`);
    if (i === 1) await shot('quiz-question.png');
    await page.click('#next');
  }
  await page.waitForSelector('#step-result:not([hidden])');
  assert.match(await page.textContent('#score'), /80점/);
  await shot('quiz-result.png');
  const rows = g.ss.getSheetByName('결과').getDataRange().getValues();
  assert.equal(rows.length, 2); assert.equal(rows[1][1], 7); assert.equal(rows[1][2], 80);

  // 휴대폰 화면
  const phone = await open(browser, g, __dirname + '/../E-quiz/Index.html', { width: 390, height: 844 });
  await phone.waitForSelector('#nums button');
  await phone.click('#nums button:nth-child(3)');
  await phone.click('#start');
  await phone.click('#choices .choice[data-i="1"]');
  await phone.screenshot({ path: path.join(out, 'quiz-phone.png') });

  // 제출 끄기 상태
  g.ss.getSheetByName('설정').getRange(4, 2).setValue('끄기');
  const closed = await open(browser, g, __dirname + '/../E-quiz/Index.html', { width: 820, height: 500 });
  await closed.waitForSelector('#msg:not([hidden])');
  assert.match(await closed.textContent('#msg'), /퀴즈 시간이 아니에요/);

  await browser.close();
  console.log('E: 화면 테스트 통과');
})().catch((e) => { console.error(e); process.exit(1); });
