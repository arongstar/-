// 구글 Apps Script 환경을 흉내 내는 간단한 가짜(mock) — 로컬 테스트용
const vm = require('vm');
const fs = require('fs');

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) { const v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); }
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    if (vals.length !== this.nr || vals.some((r) => r.length !== this.nc)) throw new Error('setValues 크기 불일치');
    vals.forEach((row, i) => row.forEach((v, j) => {
      const R = this.r - 1 + i; while (this.sheet.data.length <= R) this.sheet.data.push([]);
      this.sheet.data[R][this.c - 1 + j] = v;
    }));
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  getValue() { return this.getValues()[0][0]; }
}
class Sheet {
  constructor(name) { this.name = name; this.data = []; this.frozen = 0; }
  getName() { return this.name; }
  getLastRow() { let n = this.data.length; while (n > 0 && (this.data[n - 1] || []).every((v) => v === '' || v === undefined)) n--; return n; }
  getLastColumn() { return Math.max(0, ...this.data.map((r) => r.length)); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  appendRow(row) { this.data.splice(this.getLastRow(), 0, row.slice()); return this; }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  setFrozenRows(n) { this.frozen = n; }
}
class Spreadsheet {
  constructor() { this.sheets = []; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
}

function load(codePath, opts = {}) {
  const ss = new Spreadsheet();
  const state = { activeEmail: opts.owner || 'teacher@school.kr', owner: opts.owner || 'teacher@school.kr' };
  const ctx = {
    console, Date, Math, JSON, String, Number, Object, Array, Error, RegExp,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Session: {
      getActiveUser: () => ({ getEmail: () => state.activeEmail }),
      getEffectiveUser: () => ({ getEmail: () => state.owner }),
      getScriptTimeZone: () => 'Asia/Seoul',
    },
    Utilities: {
      getUuid: () => 'id-' + Math.random().toString(36).slice(2, 10),
      formatDate: (d, tz, fmt) => {
        const p = (n) => String(n).padStart(2, '0');
        return fmt.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
          .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes()));
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    HtmlService: { createHtmlOutputFromFile: () => ({ setTitle() { return this; }, addMetaTag() { return this; } }) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx, { filename: codePath });
  // google.script.run 처럼 JSON 으로 주고받기 (Date 등 직렬화 문제를 잡기 위해)
  const call = (fn, ...args) => {
    if (typeof ctx[fn] !== 'function') throw new Error('서버 함수 없음: ' + fn);
    const res = ctx[fn](...JSON.parse(JSON.stringify(args)));
    if (containsDate(res)) throw new Error(fn + ' 반환값에 Date 가 들어 있어요 (google.script.run 은 Date 를 넘기지 못함)');
    return res === undefined ? null : JSON.parse(JSON.stringify(res));
  };
  return { ss, state, ctx, call, as(email) { state.activeEmail = email; return this; } };
}
function containsDate(v) {
  if (v instanceof Date) return true;
  if (v && typeof v === 'object') return Object.values(v).some(containsDate);
  return false;
}
module.exports = { load };
