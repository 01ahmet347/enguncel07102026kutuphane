import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/firebase-messaging-sw.js', import.meta.url), 'utf8');
const origin = 'https://sgm.example';
function setup(windows = []) {
  const handlers = new Map();
  const shown = [];
  const imports = [];
  const opened = [];
  const initialized = [];
  let backgroundHandler;
  const self = {
    location: { href: `${origin}/firebase-messaging-sw.js?apiKey=testkey&projectId=test-project`, origin },
    addEventListener(name, handler) { handlers.set(name, handler); },
    registration: { showNotification: (...args) => { shown.push(args); return Promise.resolve(); } }
  };
  runInNewContext(source, {
    self, clients: { matchAll: async () => windows, openWindow: async url => { opened.push(url); } },
    URL, Object,
    importScripts: (...urls) => imports.push(...urls),
    firebase: { initializeApp: config => initialized.push(config), messaging: () => ({ onBackgroundMessage: callback => { backgroundHandler = callback; } }) }
  });
  return { handlers, shown, imports, opened, initialized, background: data => backgroundHandler(data) };
}
function click(s, data) {
  let awaited = Promise.resolve();
  let stopped = false;
  const notification = { data, close() { this.closed = true; } };
  s.handlers.get('notificationclick')({ notification, waitUntil: promise => { awaited = promise; }, stopImmediatePropagation: () => { stopped = true; } });
  return { awaited, notification, get stopped() { return stopped; } };
}

test('Firebase compat yapılandırması korunur', () => {
  const s = setup();
  assert.equal(s.imports.length, 2);
  assert.equal(s.initialized[0].apiKey, 'testkey');
  assert.equal(s.initialized[0].projectId, 'test-project');
});

test('FCM notification içeren push ikinci bildirim oluşturmaz', async () => {
  const s = setup();
  await s.background({ notification: { title: 'İhbar' }, data: { type: 'İHBAR' } });
  assert.equal(s.shown.length, 0);
});

test('Data-only ihbar tek arka plan bildirimi üretir', async () => {
  const s = setup();
  await s.background({ data: { title: 'Masanız İhbar Edildi', body: 'QR okutun', type: 'İHBAR', logId: 'report-5', url: '/' } });
  assert.equal(s.shown.length, 1);
  assert.equal(s.shown[0][0], 'Masanız İhbar Edildi');
  assert.equal(s.shown[0][1].requireInteraction, true);
  assert.equal(s.shown[0][1].tag, 'sgm-report-5');
});

test('Bildirim tıklanınca açık uygulama sekmesi odağa gelir; çift tıklama işlemi engellenir', async () => {
  const calls = [];
  const s = setup([{ url: `${origin}/`, navigate: async url => { calls.push(['navigate', url]); return { focus: async () => calls.push(['focus']) }; }, focus: async () => calls.push(['old-focus']) }]);
  const event = click(s, { url: '/' });
  await event.awaited;
  assert.equal(event.stopped, true);
  assert.equal(event.notification.closed, true);
  assert.deepEqual(calls, [['navigate', `${origin}/`], ['focus']]);
  assert.equal(s.opened.length, 0);
});

test('Uygulama açık değilse aynı origin üzerinde pencere açılır', async () => {
  const s = setup([]);
  const event = click(s, { FCM_MSG: { data: { url: '/?notification=report' } } });
  await event.awaited;
  assert.deepEqual(s.opened, [`${origin}/?notification=report`]);
});

test('FCM fcmOptions bağlantısı geri dönüş seçeneği olarak kullanılabilir', async () => {
  const s = setup([]);
  const event = click(s, { FCM_MSG: { fcmOptions: { link: `${origin}/?source=fcm` } } });
  await event.awaited;
  assert.deepEqual(s.opened, [`${origin}/?source=fcm`]);
});

test('Başka origin veya javascript URL bildirime dokunarak açılamaz', async () => {
  const s = setup([]);
  for (const url of ['https://other.example/', 'javascript:alert(1)']) {
    const event = click(s, { url });
    await event.awaited;
    assert.equal(event.stopped, true);
  }
  assert.equal(s.opened.length, 0);
});

test('Bozuk/ulaşılamayan mevcut sekme yüzünden bildirim kaybolmaz', async () => {
  const s = setup([{ url: `${origin}/`, navigate: async () => { throw Error('closed'); }, focus: async () => {} }]);
  const event = click(s, { url: '/' });
  await event.awaited;
  assert.deepEqual(s.opened, [`${origin}/`]);
});
