/**
 * 우리 반 복습 퀴즈 — 구글 시트 + Apps Script 웹앱
 *
 * 처음 한 번만: 위쪽 함수 목록에서 setup 을 고르고 ▶ 실행을 눌러요.
 *   → '설정', '문제', '결과', '요약' 탭과 예시 문제 5개가 만들어져요.
 * 문제는 '문제' 탭에서 바꾸면 되고, 학생 기록은 '결과' 탭에 쌓여요.
 * 학생 이름은 받지 않고 '번호'만 받아요 (개인정보 최소화).
 */

const SHEET = { SETTING: '설정', QUESTION: '문제', RESULT: '결과', SUMMARY: '요약' };

// 처음 한 번 실행: 탭과 예시 문제 만들기
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const make = (name, header) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(header);
      sh.setFrozenRows(1);
    }
    return sh;
  };

  const setting = make(SHEET.SETTING, ['항목', '값']);
  if (setting.getLastRow() === 1) {
    setting.appendRow(['퀴즈 제목', '4학년 과학 · 물의 상태 변화']);
    setting.appendRow(['학생 수', 24]);
    setting.appendRow(['제출 받기', '켜기']);
  }

  const question = make(SHEET.QUESTION, ['문제', '보기1', '보기2', '보기3', '보기4', '정답(번호)', '해설']);
  if (question.getLastRow() === 1) {
    [
      ['얼음이 녹아 물이 되는 것은 어떤 변화일까요?', '얼음 → 물', '물 → 얼음', '물 → 수증기', '수증기 → 물', 1, '따뜻해지면 얼음이 녹아 물이 돼요.'],
      ['젖은 빨래가 마르는 것과 관계있는 것은?', '응결', '증발', '얼기', '녹기', 2, '빨래 속 물이 수증기가 되어 날아가요. 이것을 증발이라고 해요.'],
      ['차가운 컵 겉면에 물방울이 맺히는 까닭은?', '컵에서 물이 새어서', '공기 중 수증기가 물이 되어서', '얼음이 녹아서', '컵이 따뜻해서', 2, '공기 중의 수증기가 차가운 컵에 닿아 물이 돼요 (응결).'],
      ['물이 끓을 때 생기는 거품 속에는 무엇이 있을까요?', '공기', '수증기', '얼음', '모래', 2, '물 속에서 생긴 수증기가 거품이 되어 올라와요.'],
      ['물을 얼리면 부피는 어떻게 될까요?', '줄어든다', '늘어난다', '그대로다', '없어진다', 2, '물이 얼면 부피가 늘어나요. 그래서 꽉 찬 병을 얼리면 터질 수 있어요.'],
    ].forEach((row) => question.appendRow(row));
  }

  make(SHEET.RESULT, ['제출 시각', '번호', '점수', '맞힌 개수', '문제 수', '고른 답']);
  make(SHEET.SUMMARY, ['문제', '정답률(%)', '맞힌 학생 수', '응답 수']);
}

// 웹앱 주소로 들어오면 Index.html 화면을 보여 줘요
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('우리 반 복습 퀴즈')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// '설정' 탭을 { 항목: 값 } 으로 읽기
function readSettings_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.SETTING);
  if (!sh) throw new Error('시트가 아직 준비되지 않았어요. 편집기에서 setup 을 먼저 실행해 주세요.');
  const out = {};
  sh.getDataRange().getValues().slice(1).forEach((r) => { if (r[0] !== '') out[String(r[0]).trim()] = r[1]; });
  return out;
}

// '문제' 탭 읽기 (빈 줄은 건너뜀)
function readQuestions_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.QUESTION);
  if (!sh) throw new Error('문제 탭이 없어요. setup 을 먼저 실행해 주세요.');
  return sh.getDataRange().getValues().slice(1)
    .filter((r) => String(r[0]).trim() !== '')
    .map((r) => ({
      text: String(r[0]).trim(),
      choices: [r[1], r[2], r[3], r[4]].map((c) => String(c).trim()).filter((c) => c !== ''),
      answer: Number(r[5]),
      explain: String(r[6] || '').trim(),
    }));
}

// 학생 화면이 처음 부르는 함수: 제목, 학생 수, 문제 (정답은 보내지 않음)
function getQuiz() {
  const s = readSettings_();
  const qs = readQuestions_();
  return {
    title: String(s['퀴즈 제목'] || '우리 반 복습 퀴즈'),
    students: Math.max(1, Math.min(40, Number(s['학생 수']) || 24)),
    open: String(s['제출 받기'] || '켜기').trim() !== '끄기',
    questions: qs.map((q) => ({ text: q.text, choices: q.choices })),
  };
}

// 학생이 [제출]을 누르면: 채점 → '결과' 탭에 저장 → '요약' 탭 다시 계산 → 결과 돌려주기
function submitAnswers(number, answers) {
  const s = readSettings_();
  if (String(s['제출 받기'] || '켜기').trim() === '끄기') throw new Error('지금은 제출을 받지 않아요. 선생님께 여쭤보세요.');
  const students = Math.max(1, Math.min(40, Number(s['학생 수']) || 24));
  const no = Number(number);
  if (!Number.isInteger(no) || no < 1 || no > students) throw new Error('번호를 다시 골라 주세요. (1~' + students + '번)');

  const qs = readQuestions_();
  if (!Array.isArray(answers) || answers.length !== qs.length) throw new Error('모든 문제에 답해 주세요.');
  const picked = answers.map((a) => Number(a));
  if (picked.some((a, i) => !Number.isInteger(a) || a < 1 || a > qs[i].choices.length)) throw new Error('답을 다시 골라 주세요.');

  const review = qs.map((q, i) => ({
    text: q.text,
    picked: q.choices[picked[i] - 1],
    answer: q.choices[q.answer - 1] || '',
    ok: picked[i] === q.answer,
    explain: q.explain,
  }));
  const correct = review.filter((r) => r.ok).length;
  const score = Math.round((correct / qs.length) * 100);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // 여러 학생이 동시에 제출해도 기록이 섞이지 않게
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheetByName(SHEET.RESULT).appendRow([new Date(), no, score, correct, qs.length, picked.join(',')]);
    updateSummary_(qs);
  } finally {
    lock.releaseLock();
  }
  return { number: no, score: score, correct: correct, total: qs.length, review: review };
}

// '요약' 탭: 문제별 정답률 (번호별 가장 최근 제출만 셈)
function updateSummary_(qs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName(SHEET.RESULT).getDataRange().getValues().slice(1).filter((r) => r[1] !== '');
  const latest = {};
  rows.forEach((r) => { latest[r[1]] = String(r[5]).split(',').map(Number); });
  const answers = Object.values(latest);
  const out = qs.map((q, i) => {
    const ok = answers.filter((a) => a[i] === q.answer).length;
    return [q.text, answers.length ? Math.round((ok / answers.length) * 100) : 0, ok, answers.length];
  });
  const sh = ss.getSheetByName(SHEET.SUMMARY);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 4).setValues(Array.from({ length: last - 1 }, () => ['', '', '', '']));
  if (out.length) sh.getRange(2, 1, out.length, 4).setValues(out);
}
