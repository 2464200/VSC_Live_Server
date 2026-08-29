const SHEET_NAME = 'MOBILE_DISPLAY';
const PAYLOAD_CELL = 'A1';
const UPDATED_CELL = 'A2';

function doPost(event) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty('MOBILE_DISPLAY_SECRET');
  const receivedSecret = String(event.parameter.token || '');
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return response_({ ok: false, error: 'Unauthorized' });
  }

  try {
    const payload = JSON.parse(event.postData.contents || '{}');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
      || SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
    sheet.getRange(PAYLOAD_CELL).setValue(JSON.stringify(payload));
    sheet.getRange(UPDATED_CELL).setValue(new Date().toISOString());
    return response_({ ok: true });
  } catch (error) {
    return response_({ ok: false, error: String(error.message || error) });
  }
}

function doGet(event) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const raw = sheet ? String(sheet.getRange(PAYLOAD_CELL).getValue() || '{}') : '{}';
  let payload = {};
  try { payload = JSON.parse(raw); } catch (_) {}
  const callback = String(event.parameter.callback || '');
  if (/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return response_(payload);
}

function response_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}