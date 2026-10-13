import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
const rulesPath = resolve(root, config.firestore.rules);
const rules = readFileSync(rulesPath, 'utf8');

// These are static compatibility checks, NOT an Emulator or live permission test.
test('Firebase CLI güvenlik kural dosyası belirtilen kök konumda', () => {
  assert.equal(config.firestore.rules, 'firestore.rules');
  assert.ok(existsSync(rulesPath));
  assert.equal(rules, readFileSync(resolve(root, 'docs/firestore.rules'), 'utf8'));
});

test('Kullanıcının Firebase Hosting ayarları değiştirilmedi', () => {
  assert.equal(config.hosting.public, 'dist');
  assert.deepEqual(config.hosting.ignore, ['firebase.json', '**/.*', '**/node_modules/**']);
  assert.deepEqual(config.hosting.rewrites, [{source:'**',destination:'/index.html'}]);
});

test('Firestore admin yazıları güncel oturum kimliğiyle sınırlandırır', () => {
  assert.match(rules, /function isActiveAdmin\(appId\)/);
  assert.match(rules, /request\.auth\.token\.adminSessionId/);
  assert.match(rules, /sgmAdminSessions\/current/);
  assert.match(rules, /sessionId == request\.auth\.token\.adminSessionId/);
  assert.match(rules, /allow write: if isActiveAdmin\(appId\)/);
});

test('Öğrenci kendi kullanıcı ve mesajını okuyabilir, genel yazma kapalı', () => {
  assert.match(rules, /function isStudent\(userId\)/);
  assert.match(rules, /isStudent\(documentId\)/);
  assert.match(rules, /allow list: if isActiveAdmin\(appId\)/);
  assert.match(rules, /allow read, write: if false/);
});

test('Yönetici aktif oturumunu kullanıcı değiştiremez; yalnızca sunucu oluşturur', () => {
  assert.match(rules, /match \/artifacts\/\{appId\}\/public\/data\/sgmAdminSessions\/\{documentId\}/);
  assert.match(rules, /allow list, create, update, delete: if false/);
});
