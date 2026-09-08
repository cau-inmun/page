/**
 * 구글 스프레드시트로 폼 응답 받기
 * ------------------------------------------------------------------
 * 사이트에서 폼이 제출되면 이 스크립트가 시트에 한 줄씩 추가합니다.
 * 구글폼처럼 시트에서 바로 확인 · 정렬 · 필터할 수 있습니다.
 *
 * 설치 방법은 README 의 '구글 시트로 응답 받기' 를 보세요.
 *
 * 폼마다 시트 탭이 자동으로 생기고, 새 항목이 추가되면 열도 자동으로
 * 늘어납니다. 관리자에서 폼 항목을 바꿔도 손댈 필요가 없습니다.
 *
 * ── 코드를 고친 뒤에는 반드시 다시 배포해야 합니다 ──
 *   배포 → 배포 관리 → 연필(수정) → 버전 '새 버전' → 배포
 *   이렇게 하면 웹 앱 주소는 그대로이고 내용만 최신으로 바뀝니다.
 *   ('새 배포' 를 누르면 주소가 새로 생겨서 사이트 코드도 고쳐야 합니다)
 */

/* 스프레드시트에서 '확장 프로그램 → Apps Script' 로 만들었다면 비워두세요.
   script.google.com 에서 따로 만든 스크립트라면, 응답을 쌓을 시트를 열어
   주소창의 /d/ 와 /edit 사이 문자열을 여기에 붙여넣으세요. */
var SHEET_ID = '';

/** 응답을 쌓을 스프레드시트를 찾는다. 못 찾으면 이유를 말해준다. */
function openBook() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  throw new Error(
    '연결된 스프레드시트가 없습니다. 시트에서 「확장 프로그램 → Apps Script」 로 ' +
    '만들었는지 확인하거나, 이 코드 위쪽 SHEET_ID 에 시트 ID 를 넣어주세요.'
  );
}

/** payload 한 건을 알맞은 탭에 한 줄로 append */
function writeRow(payload) {
  var sheetName = String(payload.formTitle || payload.formId || '응답').substring(0, 90);
  var ss = openBook();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['접수 시각']);
    sheet.setFrozenRows(1);
  }

  /* 열 이름은 학우가 화면에서 본 항목 이름(라벨)으로 쓴다.
     시트만 열어봐도 무슨 칸인지 알 수 있어야 하기 때문이다.
     관리자에서 항목 이름을 바꾸면 시트에는 새 열이 생긴다. */
  var data = payload.data || {};
  var labels = payload.labels || {};
  var order = [];
  Object.keys(labels).forEach(function (k) { order.push(k); });
  Object.keys(data).forEach(function (k) { if (order.indexOf(k) === -1) order.push(k); });

  var named = {};
  order.forEach(function (k) { named[String(labels[k] || k)] = data[k]; });

  // 첫 줄(머리글)을 읽어 새 항목이 있으면 열을 늘린다
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Object.keys(named).forEach(function (name) {
    if (header.indexOf(name) === -1) {
      header.push(name);
      sheet.getRange(1, header.length).setValue(name);
    }
  });

  // 접수 시각을 한국 시간으로
  var when = payload.submittedAt ? new Date(payload.submittedAt) : new Date();
  var row = [Utilities.formatDate(when, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')];
  for (var i = 1; i < header.length; i++) {
    var v = named[header[i]];
    row.push(v === undefined || v === null ? '' : String(v));
  }
  sheet.appendRow(row);
  return { sheet: sheetName, row: sheet.getLastRow() };
}

/** 사이트에서 폼이 제출될 때 호출된다 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var at = writeRow(payload);
    return json({ ok: true, sheet: at.sheet, row: at.row });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * 관리자 화면의 '구글 시트 연결 확인' 버튼이 호출한다.
 *
 * 브라우저는 다른 사이트의 응답을 그냥은 읽지 못하므로(CORS),
 * ?callback=이름 을 받으면 자바스크립트 형태로 감싸서 돌려준다.
 * 이렇게 해야 관리자 화면이 '됐다 / 안 됐다' 를 실제로 알 수 있다.
 *   ?test=1 이 붙으면 '연결 확인' 탭에 확인용 줄도 한 줄 남긴다.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    var ss = openBook();
    out = { ok: true, spreadsheet: ss.getName(), url: ss.getUrl() };
    if (p.test) {
      var at = writeRow({
        formTitle: '연결 확인',
        submittedAt: new Date().toISOString(),
        data: { 확인: '관리자 화면에서 연결을 확인했습니다' }
      });
      out.wrote = at.sheet + ' ' + at.row + '행';
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return p.callback ? jsonp(p.callback, out) : json(out);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp(name, obj) {
  var safe = String(name).replace(/[^A-Za-z0-9_$]/g, '');
  return ContentService.createTextOutput(safe + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
