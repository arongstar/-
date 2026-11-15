const assert = require('assert');
const { load } = require('./gas-mock.cjs');
const g = load(__dirname + '/../B-learning-log/Code.gs');
g.call('setup');
const ss = g.ss;
ss.getSheetByName('학생').appendRow([1, '김하늘', 's1@school.kr']);
ss.getSheetByName('학생').appendRow([2, '이도윤', 'S2@school.kr']);
ss.getSheetByName('차시').appendRow([1, new Date(2026, 10, 3), '[6국03-02]', '주장과 근거 찾기', '근거 2개 이상', '근거 1개', '근거 없음', 'Y']);
ss.getSheetByName('차시').appendRow([2, new Date(2026, 10, 5), '[6국03-02]', '주장하는 글 쓰기', 'a', 'b', 'c', 'N']);

assert.equal(g.as('teacher@school.kr').call('whoAmI').role, 'teacher');
assert.equal(g.as('s1@school.kr').call('whoAmI').role, 'student');
assert.equal(g.as('s2@school.kr').call('whoAmI').role, 'student', '대소문자 무시');
assert.equal(g.as('nobody@x.kr').call('whoAmI').role, 'unknown');
assert.equal(g.as('').call('whoAmI').role, 'unknown');

let d = g.as('s1@school.kr').call('getStudentData');
assert.equal(d.lessons.length, 1, '닫힌 차시는 안 보임');
assert.throws(() => g.call('submitReflection', '1', '', '', 2), /배운 점/);
assert.throws(() => g.call('submitReflection', '1', 'x', '', 5), /자기평가/);
assert.throws(() => g.call('submitReflection', '2', 'x', '', 2), /기록할 수 없는/);
assert.equal(g.call('submitReflection', '1', '주장에는 근거가 필요하다', '근거 고르기', 2).updated, false);
assert.equal(g.call('submitReflection', '1', '주장에는 타당한 근거가 필요하다', '', 3).updated, true);
d = g.call('getStudentData');
assert.equal(d.records.length, 1); assert.equal(d.records[0].self, 3);
assert.throws(() => g.call('getTeacherData'), /교사만/);
assert.throws(() => g.call('saveEvaluation', d.records[0].id, '잘함', 'x'), /교사만/);

g.as('s2@school.kr').call('submitReflection', '1', '근거를 알았다', '', 1);
const t = g.as('teacher@school.kr').call('getTeacherData');
assert.equal(t.records.length, 2); assert.equal(t.students.length, 2);
assert.throws(() => g.call('saveEvaluation', t.records[0].id, '최고', ''), /단계/);
assert.equal(g.call('saveEvaluation', t.records[0].id, '잘함', '근거가 타당해요'), true);
const s1 = g.as('s1@school.kr').call('getStudentData');
assert.equal(s1.records[0].level, '잘함'); assert.equal(s1.records[0].feedback, '근거가 타당해요');
// 학생이 다시 써도 교사 평가는 유지
g.call('submitReflection', '1', '다시 씀', '', 3);
assert.equal(g.call('getStudentData').records[0].level, '잘함');
// 다른 학생 기록은 안 보임
assert.equal(g.as('s2@school.kr').call('getStudentData').records.every((r) => r.email.toLowerCase() === 's2@school.kr'), true);
console.log('B: 모든 서버 테스트 통과');
