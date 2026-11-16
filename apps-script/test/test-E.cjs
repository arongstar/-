// E. 우리 반 복습 퀴즈 — 서버 코드 테스트
const assert = require('assert');
const { load } = require('./gas-mock.cjs');
const g = load(__dirname + '/../E-quiz/Code.gs');

assert.throws(() => g.call('getQuiz'), /setup/);
g.call('setup');
g.call('setup'); // 두 번 실행해도 예시 문제가 늘지 않아야 함
assert.equal(g.ss.getSheetByName('문제').getLastRow(), 6);

const q = g.call('getQuiz');
assert.equal(q.students, 24);
assert.equal(q.questions.length, 5);
assert.equal(q.open, true);
assert.ok(!('answer' in q.questions[0]), '정답이 학생 화면으로 가면 안 됨');

assert.throws(() => g.call('submitAnswers', 0, [1, 2, 2, 2, 2]), /번호/);
assert.throws(() => g.call('submitAnswers', 25, [1, 2, 2, 2, 2]), /번호/);
assert.throws(() => g.call('submitAnswers', 3, [1, 2]), /모든 문제/);
assert.throws(() => g.call('submitAnswers', 3, [1, 2, 2, 2, 9]), /답을/);

let r = g.call('submitAnswers', 3, [1, 2, 2, 2, 2]);
assert.equal(r.score, 100); assert.equal(r.correct, 5);
r = g.call('submitAnswers', 7, [2, 2, 1, 2, 2]);
assert.equal(r.correct, 3); assert.equal(r.score, 60);
assert.equal(r.review[0].ok, false); assert.equal(r.review[0].answer, '얼음 → 물');

// 같은 번호가 다시 내면 요약에는 최근 것만
g.call('submitAnswers', 7, [1, 2, 2, 2, 2]);
const res = g.ss.getSheetByName('결과');
assert.equal(res.getLastRow(), 4);
const sum = g.ss.getSheetByName('요약').getDataRange().getValues();
assert.deepEqual(sum[1].slice(1), [100, 2, 2]);

// 문제를 줄이면 요약 표도 줄어듦
g.ss.getSheetByName('문제').deleteRow(6);
g.call('submitAnswers', 1, [1, 2, 2, 2]);
assert.equal(g.ss.getSheetByName('요약').getLastRow(), 5);

// 제출 끄기
g.ss.getSheetByName('설정').getRange(4, 2).setValue('끄기');
assert.equal(g.call('getQuiz').open, false);
assert.throws(() => g.call('submitAnswers', 2, [1, 2, 2, 2]), /제출을 받지/);
console.log('E: 모든 서버 테스트 통과');
