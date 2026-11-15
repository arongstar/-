/**
 * 태블릿 대여·반납 기록부 (Google Apps Script 웹앱)
 * - 기기 카드를 눌러 번호를 입력하면 대여, 다시 누르면 반납
 * - 모든 대여·반납이 '기록' 시트에 시각과 함께 쌓이고, 미반납 기기가 한눈에 보임
 *
 * 배포: [배포] → [새 배포] → '웹 앱' / 실행: 나 / 액세스: 우리 학교 도메인의 모든 사용자
 */

const SHEETS = {
  settings: { name: '설정', header: ['항목', '값', '설명'] },
  devices: { name: '기기', header: ['기기번호', '메모'] },
  log: { name: '기록', header: ['시각', '기기번호', '구분', '학생 번호', '계정'] },
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('태블릿 대여·반납')
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
    st.getRange(2, 1, 2, 3).setValues([
      ['학급명', '6학년 1반', '화면 위에 보일 이름'],
      ['교사 이메일', Session.getEffectiveUser().getEmail(), '기록 화면을 볼 계정 (쉼표로 여러 명)'],
    ]);
  }
  const dv = ss.getSheetByName('기기');
  if (dv.getLastRow() === 1) {
    const rows = [];
    for (let i = 1; i <= 12; i++) rows.push(['T' + (i < 10 ? '0' + i : i), '']);
    dv.getRange(2, 1, rows.length, 2).setValues(rows);
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
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  return v === null || v === undefined ? '' : String(v);
}
function settings_() {
  const out = {};
  rows_('settings').forEach(function (r) { out[str_(r[0]).trim()] = str_(r[1]).trim(); });
  return out;
}
function isTeacher_() {
  const me = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const list = (settings_()['교사 이메일'] || '').split(',').map(function (s) { return s.trim().toLowerCase(); });
  list.push((Session.getEffectiveUser().getEmail() || '').toLowerCase());
  return !!me && list.indexOf(me) >= 0;
}

/** 기기마다 마지막 기록을 보고 지금 상태를 계산 */
function status_() {
  const last = {};
  rows_('log').forEach(function (r) { last[str_(r[1])] = r; });
  return rows_('devices').map(function (d) {
    const id = str_(d[0]);
    const l = last[id];
    const out = l && str_(l[2]) === '대여';
    return { id: id, memo: str_(d[1]), out: out, who: out ? str_(l[3]) : '', since: out ? str_(l[0]) : '' };
  });
}

function getBoard() {
  const teacher = isTeacher_();
  const log = teacher ? rows_('log').slice(-60).reverse().map(function (r) {
    return { at: str_(r[0]), id: str_(r[1]), type: str_(r[2]), who: str_(r[3]) };
  }) : [];
  return { className: settings_()['학급명'] || '', isTeacher: teacher, devices: status_(), log: log };
}

function record_(id, type, number) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const dev = status_().filter(function (d) { return d.id === String(id); })[0];
    if (!dev) throw new Error('없는 기기예요.');
    if (type === '대여' && dev.out) throw new Error(dev.id + '는 이미 ' + dev.who + '번이 쓰고 있어요.');
    if (type === '반납' && !dev.out) throw new Error(dev.id + '는 이미 반납되어 있어요.');
    sheet_('log').appendRow([new Date(), dev.id, type, number, Session.getActiveUser().getEmail() || '']);
    return getBoard();
  } finally {
    lock.releaseLock();
  }
}
function rent(id, number) {
  number = String(number || '').trim();
  if (!/^\d{1,2}$/.test(number)) throw new Error('번호를 숫자로 입력해 주세요.');
  return record_(id, '대여', number);
}
function giveBack(id) {
  const dev = status_().filter(function (d) { return d.id === String(id); })[0];
  return record_(id, '반납', dev ? dev.who : '');
}
