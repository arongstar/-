/**
 * 우리 반 독서 기록장 (Google Apps Script 웹앱)
 * - 학생: 학교 구글 계정으로 접속해 읽은 책을 기록하고 내 책장을 확인
 * - 우리 반: 전체 권수와 많이 읽은 책 (학생 이름·순위는 보여 주지 않음)
 * - 교사: 학생별 독서량과 기록을 보고 '확인' 표시
 *
 * 배포: [배포] → [새 배포] → '웹 앱' / 실행: 나 / 액세스: 우리 학교 도메인의 모든 사용자
 */

const SHEETS = {
  settings: { name: '설정', header: ['항목', '값', '설명'] },
  students: { name: '학생', header: ['번호', '이름', '이메일'] },
  books: { name: '독서', header: ['기록ID', '기록 시각', '이메일', '번호', '이름', '책 제목', '지은이', '다 읽은 날', '별점(1~5)', '한 줄 감상', '기억에 남는 문장', '교사 확인'] },
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('우리 반 독서 기록장')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    const def = SHEETS[key];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, def.header.length).setValues([def.header]); sh.setFrozenRows(1); }
  });
  const st = ss.getSheetByName('설정');
  if (st.getLastRow() === 1) {
    st.getRange(2, 1, 3, 3).setValues([
      ['학급명', '6학년 1반', '화면 위에 보일 이름'],
      ['교사 이메일', Session.getEffectiveUser().getEmail(), '교사 화면을 볼 계정 (쉼표로 여러 명)'],
      ['학기 목표 권수', 20, '학생 책장에 보일 목표'],
    ]);
  }
}

function sheet_(key) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS[key].name);
  if (!sh) throw new Error('"' + SHEETS[key].name + '" 시트가 없어요. 먼저 setup 함수를 실행해 주세요.');
  return sh;
}
function rows_(key) {
  return sheet_(key).getDataRange().getValues().slice(1).filter(function (r) { return r.join('') !== ''; });
}
function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}
function settings_() {
  const out = {};
  rows_('settings').forEach(function (r) { out[str_(r[0]).trim()] = str_(r[1]).trim(); });
  return out;
}
function email_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
function isTeacher_() {
  const list = (settings_()['교사 이메일'] || '').split(',').map(function (s) { return s.trim().toLowerCase(); });
  list.push((Session.getEffectiveUser().getEmail() || '').toLowerCase());
  return !!email_() && list.indexOf(email_()) >= 0;
}
function student_() {
  const e = email_();
  const r = rows_('students').filter(function (s) { return str_(s[2]).trim().toLowerCase() === e; })[0];
  return r ? { number: str_(r[0]), name: str_(r[1]), email: e } : null;
}
function book_(r) {
  return { id: str_(r[0]), email: str_(r[2]).toLowerCase(), number: str_(r[3]), name: str_(r[4]), title: str_(r[5]), author: str_(r[6]),
           doneOn: str_(r[7]), stars: Number(r[8]) || 0, comment: str_(r[9]), quote: str_(r[10]), checked: str_(r[11]) === 'Y' };
}
function classStats_(books) {
  const month = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd').slice(0, 7);
  const count = {};
  books.filter(function (b) { return b.doneOn.slice(0, 7) === month; }).forEach(function (b) {
    const k = b.title.replace(/\s+/g, ' ').trim(); count[k] = (count[k] || 0) + 1;
  });
  const popular = Object.keys(count).map(function (k) { return { title: k, n: count[k] }; })
    .sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
  return { total: books.length, thisMonth: books.filter(function (b) { return b.doneOn.slice(0, 7) === month; }).length, popular: popular };
}

function whoAmI() {
  const s = settings_();
  const base = { className: s['학급명'] || '', goal: Number(s['학기 목표 권수']) || 0, email: email_() };
  if (isTeacher_()) return Object.assign(base, { role: 'teacher' });
  const st = student_();
  if (st) return Object.assign(base, { role: 'student', number: st.number, name: st.name });
  return Object.assign(base, { role: 'unknown' });
}

function getMyShelf() {
  const me = student_();
  if (!me) throw new Error('학생 명단에 없는 계정이에요.');
  const all = rows_('books').map(book_);
  return { mine: all.filter(function (b) { return b.email === me.email; }), stats: classStats_(all) };
}

function addBook(b) {
  const me = student_();
  if (!me) throw new Error('학생 명단에 없는 계정이에요.');
  b = b || {};
  const title = String(b.title || '').trim().slice(0, 100);
  const stars = Number(b.stars);
  if (!title) throw new Error('책 제목을 적어 주세요.');
  if ([1, 2, 3, 4, 5].indexOf(stars) < 0) throw new Error('별점을 골라 주세요.');
  if (!String(b.comment || '').trim()) throw new Error('한 줄 감상을 적어 주세요.');
  const doneOn = /^\d{4}-\d{2}-\d{2}$/.test(String(b.doneOn)) ? String(b.doneOn) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  sheet_('books').appendRow([Utilities.getUuid(), new Date(), me.email, me.number, me.name, title,
    String(b.author || '').trim().slice(0, 60), doneOn, stars, String(b.comment).trim().slice(0, 300), String(b.quote || '').trim().slice(0, 300), '']);
  return getMyShelf();
}

function deleteMyBook(id) {
  const me = student_();
  if (!me) throw new Error('학생 명단에 없는 계정이에요.');
  const sh = sheet_('books');
  const values = sh.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (str_(values[i][0]) === String(id)) {
      if (str_(values[i][2]).toLowerCase() !== me.email) throw new Error('내 기록만 지울 수 있어요.');
      sh.deleteRow(i + 1);
      return getMyShelf();
    }
  }
  throw new Error('기록을 찾지 못했어요.');
}

function getTeacherView() {
  if (!isTeacher_()) throw new Error('교사만 볼 수 있어요.');
  const students = rows_('students').map(function (r) { return { number: str_(r[0]), name: str_(r[1]), email: str_(r[2]).trim().toLowerCase() }; });
  const books = rows_('books').map(book_);
  return { students: students, books: books, stats: classStats_(books) };
}

function toggleCheck(id) {
  if (!isTeacher_()) throw new Error('교사만 할 수 있어요.');
  const sh = sheet_('books');
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (str_(values[i][0]) === String(id)) {
      const next = str_(values[i][11]) === 'Y' ? '' : 'Y';
      sh.getRange(i + 1, 12, 1, 1).setValues([[next]]);
      return next === 'Y';
    }
  }
  throw new Error('기록을 찾지 못했어요.');
}
