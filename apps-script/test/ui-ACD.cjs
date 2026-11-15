const { chromium } = require('playwright');
const { load } = require('./gas-mock.cjs');
const { open } = require('./ui-harness.cjs');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  // A
  let g = load(__dirname + '/../A-device-rental/Code.gs'); g.call('setup');
  g.call('rent', 'T03', '12'); g.call('rent', 'T07', '4');
  let p = await open(b, g, __dirname + '/../A-device-rental/Index.html');
  await p.click('text=T01'); await p.fill('#num', '5'); await p.click('#ok'); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/A-teacher.png', fullPage: true });
  g.as('stu@school.kr'); p = await open(b, g, __dirname + '/../A-device-rental/Index.html', { width: 390, height: 844 });
  await p.click('text=T03'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/A-return-mobile.png' });
  await p.click('#ok'); await p.waitForTimeout(300);
  console.log('A out:', g.as('teacher@school.kr').call('getBoard').devices.filter(d => d.out).map(d => d.id).join(','));
  // C
  g = load(__dirname + '/../C-observation/Code.gs'); g.call('setup');
  ['김하늘','이도윤','박서아','최지호','정하린','강시우','조예준','윤수아'].forEach((n, i) => g.ss.getSheetByName('학생').appendRow([i + 1, n]));
  g.ss.getSheetByName('성취기준').appendRow(['[6국01-07]', '절차와 규칙을 지키고 타당한 이유와 근거를 제시하며 토론한다.', '타당한 근거 제시/발언 순서 지키기/반론하기/상대 의견 메모']);
  g.ss.getSheetByName('성취기준').appendRow(['[6국01-06]', '토의에 협력적으로 참여하며 서로의 의견을 비교하고 조정한다.', '의견 비교/절충안 제안/경청']);
  g.call('addObservation', '2', '[6국01-07]', '보통', '근거 1개 제시');
  g.call('addObservation', '3', '[6국01-07]', '노력 필요', '');
  p = await open(b, g, __dirname + '/../C-observation/Index.html');
  await p.click('.stu >> nth=0'); await p.click('.lv >> nth=0'); await p.click('text=+ 타당한 근거 제시'); await p.click('text=+ 반론하기'); await p.click('text=기록하기'); await p.waitForTimeout(300);
  await p.click('.stu >> nth=4'); await p.click('.lv >> nth=1'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/C-check.png', fullPage: true });
  await p.click('text=학생별 모아보기'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/C-student.png', fullPage: true });
  // D
  g = load(__dirname + '/../D-reading-log/Code.gs'); g.call('setup');
  ['김하늘','이도윤','박서아'].forEach((n, i) => g.ss.getSheetByName('학생').appendRow([i + 1, n, `s${i + 1}@school.kr`]));
  g.as('s2@school.kr'); g.call('addBook', { title: '어린 왕자', stars: 4, comment: '여우의 말이 마음에 남았다' });
  g.as('s3@school.kr'); g.call('addBook', { title: '마당을 나온 암탉', stars: 5, comment: '잎싹의 용기가 멋졌다' });
  g.as('s1@school.kr'); g.call('addBook', { title: '어린 왕자', author: '생텍쥐페리', stars: 5, comment: '길들인다는 것의 의미를 알게 되었다', quote: '네가 길들인 것에 너는 언제까지나 책임이 있어.' });
  p = await open(b, g, __dirname + '/../D-reading-log/Index.html');
  await p.fill('input >> nth=0', '아몬드'); await p.fill('input >> nth=1', '손원평');
  await p.click('.stars button >> nth=3'); await p.fill('textarea >> nth=0', '감정을 배워 가는 윤재를 응원하게 된다');
  await p.click('text=책장에 꽂기'); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/D-student.png', fullPage: true });
  g.as('teacher@school.kr'); p = await open(b, g, __dirname + '/../D-reading-log/Index.html');
  await p.click('.chk >> nth=0'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/D-teacher.png', fullPage: true });
  await b.close();
})();
