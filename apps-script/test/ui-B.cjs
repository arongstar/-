const { chromium } = require('playwright');
const { load } = require('./gas-mock.cjs');
const { open } = require('./ui-harness.cjs');
const OUT = process.argv[2];
(async () => {
  const g = load(__dirname + '/../B-learning-log/Code.gs');
  g.call('setup');
  const names = ['김하늘', '이도윤', '박서아', '최지호', '정하린'];
  names.forEach((n, i) => g.ss.getSheetByName('학생').appendRow([i + 1, n, `s${i + 1}@school.kr`]));
  const L = g.ss.getSheetByName('차시');
  L.appendRow([1, new Date(2026, 10, 3), '[6국02-01]', '글의 구조를 생각하며 요약하기', '구조에 맞게 핵심만 간추려 요약함', '중심 내용을 찾아 요약함', '중심 내용 찾기에 도움이 필요함', 'Y']);
  L.appendRow([2, new Date(2026, 10, 5), '[6국03-02]', '근거를 들어 주장하는 글 쓰기', '타당한 근거 2개 이상과 출처를 밝혀 씀', '근거 1개를 들어 씀', '주장과 근거를 구분하기 어려워함', 'Y']);
  const b = await chromium.launch();
  // 학생 화면
  g.as('s1@school.kr');
  g.call('submitReflection', '1', '문단마다 중심 문장을 찾으면 요약이 쉬워요.', '', 3);
  let p = await open(b, g, __dirname + '/../B-learning-log/Index.html');
  await p.selectOption('select', '2');
  await p.fill('textarea >> nth=0', '주장을 뒷받침하려면 근거가 타당해야 하고, 인용한 자료의 출처를 밝혀야 해요.');
  await p.fill('textarea >> nth=1', '어떤 근거가 더 타당한지 고르는 게 어려워요.');
  await p.click('text=★★ 대부분 알겠어요');
  await p.click('text=기록 저장하기');
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/B-student.png', fullPage: true });
  // 다른 학생들 기록
  ['s2', 's3', 's4'].forEach((s, i) => { g.as(s + '@school.kr'); g.call('submitReflection', '2', ['근거는 두 개 넣었어요.', '주장과 근거를 나눴어요.', '출처 쓰는 법을 배웠어요.'][i], i === 1 ? '근거 찾기가 어려웠어요' : '', [2, 1, 3][i]); });
  // 교사 화면
  g.as('teacher@school.kr');
  p = await open(b, g, __dirname + '/../B-learning-log/Index.html');
  await p.locator('tr', { hasText: '김하늘' }).locator('button', { hasText: '잘함' }).click();
  await p.locator('tr', { hasText: '김하늘' }).locator('textarea').fill('근거와 출처를 정확히 밝혔어요. 반론까지 생각해 보면 더 좋아요.');
  await p.locator('tr', { hasText: '김하늘' }).locator('button', { hasText: '저장' }).click();
  await p.locator('tr', { hasText: '박서아' }).locator('button', { hasText: '노력 필요' }).click();
  await p.locator('tr', { hasText: '박서아' }).locator('button', { hasText: '저장' }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/B-teacher-lesson.png', fullPage: true });
  await p.click('text=학생별 누적'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/B-teacher-student.png', fullPage: true });
  await p.click('text=성취기준 현황'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/B-teacher-matrix.png', fullPage: true });
  // 학생이 피드백 확인
  g.as('s1@school.kr'); p = await open(b, g, __dirname + '/../B-learning-log/Index.html', { width: 390, height: 844 });
  await p.screenshot({ path: OUT + '/B-student-mobile.png', fullPage: true });
  // 등록 안 된 계정
  g.as('guest@other.kr'); p = await open(b, g, __dirname + '/../B-learning-log/Index.html');
  console.log('unknown view:', (await p.textContent('h2')));
  const t = g.as('teacher@school.kr').call('getTeacherData');
  console.log('평가 저장:', t.records.filter(r => r.level).map(r => r.name + ':' + r.level).join(', '));
  await b.close();
})();
