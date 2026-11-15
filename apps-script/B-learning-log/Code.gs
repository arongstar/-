/**
 * 배움 기록장 + 평가 대시보드 (Google Apps Script 웹앱)
 * - 학생: 학교 구글 계정으로 접속해 차시마다 배운 점·어려운 점·자기평가를 기록하고, 선생님 피드백을 확인
 * - 교사: 차시별·학생별 기록을 보고 루브릭(잘함/보통/노력 필요)과 피드백을 남김
 *
 * 배포: [배포] → [새 배포] → 유형 '웹 앱'
 *       다음 사용자 인증 정보로 실행: 나(교사)
 *       액세스 권한이 있는 사용자: 우리 학교 도메인의 모든 사용자
 * 주의: 교사 계정과 학생 계정이 '같은 학교 구글 워크스페이스 도메인'이어야 학생 이메일을 알 수 있어요.
 */

const SHEETS = {
  settings: { name: '설정', header: ['항목', '값', '설명'] },
  students: { name: '학생', header: ['번호', '이름', '이메일'] },
  lessons: { name: '차시', header: ['차시ID', '날짜', '성취기준', '학습 주제', '잘함 기준', '보통 기준', '노력 필요 기준', '열기(Y/N)'] },
  records: { name: '기록', header: ['기록ID', '제출 시각', '이메일', '번호', '이름', '차시ID', '배운 점', '어려운 점', '자기평가(1~3)', '교사 평가', '피드백', '평가 시각'] },
};
const LEVELS = ['잘함', '보통', '노력 필요'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('배움 기록장')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- 처음 한 번: 시트 만들기 ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    const def = SHEETS[key];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, def.header.length).setValues([def.header]);
      sh.setFrozenRows(1);
    }
  });
  const st = ss.getSheetByName(SHEETS.settings.name);
  if (st.getLastRow() === 1) {
    st.getRange(2, 1, 2, 3).setValues([
      ['학급명', '6학년 1반', '화면 위에 보일 이름'],
      ['교사 이메일', Session.getEffectiveUser().getEmail(), '교사 화면을 볼 계정 (여러 명이면 쉼표로 구분)'],
    ]);
  }
}

/* ---------- 공통 도우미 ---------- */
function sheet_(key) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS[key].name);
  if (!sh) throw new Error('"' + SHEETS[key].name + '" 시트가 없어요. 먼저 setup 함수를 실행해 주세요.');
  return sh;
}
function rows_(key) {
  const values = sheet_(key).getDataRange().getValues();
  return values.slice(1).filter(function (r) { return r.join('') !== ''; });
}
function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  return v === null || v === undefined ? '' : String(v);
}
function day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return str_(v);
}
function settings_() {
  const out = {};
  rows_('settings').forEach(function (r) { out[str_(r[0]).trim()] = str_(r[1]).trim(); });
  return out;
}
function email_() {
  return (Session.getActiveUser().getEmail() || '').toLowerCase();
}
function teacherEmails_() {
  const list = (settings_()['교사 이메일'] || '').split(',').map(function (s) { return s.trim().toLowerCase(); });
  list.push((Session.getEffectiveUser().getEmail() || '').toLowerCase());
  return list.filter(Boolean);
}
function findStudent_(email) {
  const r = rows_('students').filter(function (s) { return str_(s[2]).trim().toLowerCase() === email; })[0];
  return r ? { number: str_(r[0]), name: str_(r[1]), email: email } : null;
}
function requireTeacher_() {
  if (teacherEmails_().indexOf(email_()) < 0) throw new Error('교사만 할 수 있어요.');
}
function lessons_() {
  return rows_('lessons').map(function (r) {
    return {
      id: str_(r[0]), date: day_(r[1]), standard: str_(r[2]), topic: str_(r[3]),
      rubric: { '잘함': str_(r[4]), '보통': str_(r[5]), '노력 필요': str_(r[6]) },
      open: str_(r[7]).trim().toUpperCase() !== 'N',
    };
  });
}
function record_(r) {
  return {
    id: str_(r[0]), submittedAt: str_(r[1]), email: str_(r[2]), number: str_(r[3]), name: str_(r[4]),
    lessonId: str_(r[5]), learned: str_(r[6]), hard: str_(r[7]), self: Number(r[8]) || 0,
    level: str_(r[9]), feedback: str_(r[10]), evaluatedAt: str_(r[11]),
  };
}

/* ---------- 화면에서 부르는 함수 ---------- */
function whoAmI() {
  const email = email_();
  const s = settings_();
  if (!email) return { role: 'unknown', className: s['학급명'] || '' };
  if (teacherEmails_().indexOf(email) >= 0) return { role: 'teacher', email: email, className: s['학급명'] || '' };
  const st = findStudent_(email);
  if (st) return { role: 'student', email: email, name: st.name, number: st.number, className: s['학급명'] || '' };
  return { role: 'unknown', email: email, className: s['학급명'] || '' };
}

function getStudentData() {
  const me = findStudent_(email_());
  if (!me) throw new Error('학생 명단에 없는 계정이에요. 선생님께 알려 주세요.');
  const mine = rows_('records').map(record_).filter(function (r) { return r.email.toLowerCase() === me.email; });
  return { me: me, lessons: lessons_().filter(function (l) { return l.open; }), records: mine };
}

function submitReflection(lessonId, learned, hard, self) {
  const me = findStudent_(email_());
  if (!me) throw new Error('학생 명단에 없는 계정이에요.');
  const lesson = lessons_().filter(function (l) { return l.id === String(lessonId); })[0];
  if (!lesson || !lesson.open) throw new Error('지금은 기록할 수 없는 차시예요.');
  learned = String(learned || '').trim().slice(0, 1000);
  hard = String(hard || '').trim().slice(0, 1000);
  self = Number(self);
  if (!learned) throw new Error('배운 점을 적어 주세요.');
  if ([1, 2, 3].indexOf(self) < 0) throw new Error('자기평가를 골라 주세요.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_('records');
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (str_(values[i][2]).toLowerCase() === me.email && str_(values[i][5]) === lesson.id) {
        // 같은 차시에 다시 내면 고쳐 쓰기 (교사 평가는 그대로 둠)
        sh.getRange(i + 1, 2, 1, 1).setValues([[new Date()]]);
        sh.getRange(i + 1, 7, 1, 3).setValues([[learned, hard, self]]);
        return { updated: true };
      }
    }
    sh.appendRow([Utilities.getUuid(), new Date(), me.email, me.number, me.name, lesson.id, learned, hard, self, '', '', '']);
    return { updated: false };
  } finally {
    lock.releaseLock();
  }
}

function getTeacherData() {
  requireTeacher_();
  const students = rows_('students').map(function (r) {
    return { number: str_(r[0]), name: str_(r[1]), email: str_(r[2]).trim().toLowerCase() };
  });
  return { lessons: lessons_(), students: students, records: rows_('records').map(record_), levels: LEVELS };
}

function saveEvaluation(recordId, level, feedback) {
  requireTeacher_();
  if (level && LEVELS.indexOf(level) < 0) throw new Error('평가 단계가 올바르지 않아요.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_('records');
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (str_(values[i][0]) === String(recordId)) {
        sh.getRange(i + 1, 10, 1, 3).setValues([[level || '', String(feedback || '').slice(0, 1000), new Date()]]);
        return true;
      }
    }
    throw new Error('기록을 찾지 못했어요. 새로고침해 주세요.');
  } finally {
    lock.releaseLock();
  }
}
