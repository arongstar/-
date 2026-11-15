/**
 * 수업 중 관찰 체크 앱 (교사 전용 Google Apps Script 웹앱)
 * - 성취기준을 고르고 학생 번호를 눌러 관찰 수준과 메모를 빠르게 기록
 * - 학생별로 모아 보고, 과세특(교과 세부능력 및 특기사항) 초안 재료로 복사
 *
 * 배포: [배포] → [새 배포] → '웹 앱' / 실행: 나 / 액세스: 나만 (교사 혼자 쓰는 앱)
 */

const SHEETS = {
  students: { name: '학생', header: ['번호', '이름'] },
  standards: { name: '성취기준', header: ['코드', '성취기준', '관찰 포인트(/로 구분)'] },
  obs: { name: '관찰', header: ['관찰ID', '시각', '번호', '이름', '성취기준', '수준', '메모'] },
};
const LEVELS = ['잘함', '보통', '노력 필요'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('수업 관찰 체크')
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
/** 혹시 액세스 설정을 잘못해도 교사(배포한 사람)만 쓸 수 있게 */
function requireOwner_() {
  const me = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!me || me !== owner) throw new Error('이 앱은 만든 선생님만 쓸 수 있어요.');
}
function obs_(r) {
  return { id: str_(r[0]), at: str_(r[1]), number: str_(r[2]), name: str_(r[3]), code: str_(r[4]), level: str_(r[5]), memo: str_(r[6]) };
}

function getData() {
  requireOwner_();
  return {
    students: rows_('students').map(function (r) { return { number: str_(r[0]), name: str_(r[1]) }; }),
    standards: rows_('standards').map(function (r) {
      return { code: str_(r[0]), text: str_(r[1]), points: str_(r[2]).split('/').map(function (s) { return s.trim(); }).filter(Boolean) };
    }),
    obs: rows_('obs').map(obs_),
    levels: LEVELS,
  };
}

function addObservation(number, code, level, memo) {
  requireOwner_();
  const st = rows_('students').filter(function (r) { return str_(r[0]) === String(number); })[0];
  if (!st) throw new Error('학생 번호를 확인해 주세요.');
  if (!rows_('standards').some(function (r) { return str_(r[0]) === String(code); })) throw new Error('성취기준을 골라 주세요.');
  if (LEVELS.indexOf(level) < 0) throw new Error('수준을 골라 주세요.');
  const row = [Utilities.getUuid(), new Date(), str_(st[0]), str_(st[1]), String(code), level, String(memo || '').trim().slice(0, 500)];
  sheet_('obs').appendRow(row);
  return obs_(row);
}

function deleteObservation(id) {
  requireOwner_();
  const sh = sheet_('obs');
  const values = sh.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (str_(values[i][0]) === String(id)) { sh.deleteRow(i + 1); return true; }
  }
  throw new Error('이미 지워진 기록이에요.');
}
