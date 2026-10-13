import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../kutuphaneprogramıguncell.jsx', import.meta.url), 'utf8');

test('Sunucunun oluşturduğu ihbar olayı tarayıcıdan bir daha arşivlenmez', () => {
  assert.match(code, /const alreadyRecordedByDeskServer = db && type === 'İHBAR'/);
  assert.match(code, /\(adminAuthorized \|\| studentEvent\) && !alreadyRecordedByDeskServer/);
});

test('Önceki sürümün bekleyen canonical ihbar kayıtları kuyruktan temizlenir', () => {
  assert.match(code, /isServerReportEventId\(item\.documentId\)/);
  assert.match(code, /delete readAppendOutbox\(\)\[key\]/);
});

test('İhbar servisi bekleme süresi güncellemesi const değişkenine yazmaz', () => {
  assert.match(code, /let reportWaitMinutes = 5;/);
  assert.doesNotMatch(code, /const reportWaitMinutes = 5;/);
});
