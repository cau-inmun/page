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
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = (payload.formTitle || payload.formId || '응답').substring(0, 90);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['접수 시각']);
      sheet.setFrozenRows(1);
    }

    // 첫 줄(머리글)을 읽어 새 항목이 있으면 열을 늘린다
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var data = payload.data || {};

    Object.keys(data).forEach(function (key) {
      if (header.indexOf(key) === -1) {
        header.push(key);
        sheet.getRange(1, header.length).setValue(key);
      }
    });

    // 접수 시각을 한국 시간으로
    var when = payload.submittedAt ? new Date(payload.submittedAt) : new Date();
    var row = [Utilities.formatDate(when, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')];
    for (var i = 1; i < header.length; i++) {
      var v = data[header[i]];
      row.push(v === undefined || v === null ? '' : String(v));
    }
    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
