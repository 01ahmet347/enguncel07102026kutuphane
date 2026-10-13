import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const main = readFileSync(resolve(root, 'main.js'), 'utf8');

test('Güncel index.html Vite girişini kökteki mevcut main.js yolundan başlatır', () => {
  assert.match(html, /<script\s+type="module"\s+src="\/main\.js"\s*><\/script>/);
  assert.ok(existsSync(resolve(root, 'main.js')));
  assert.match(main, /createRoot\(document\.getElementById\('root'\)\)/);
});

test('Kullanıcının HTML meta verileri ve root bağlantısı değiştirilmez', () => {
  assert.match(html, /<html lang="tr">/);
  assert.match(html, /<meta name="theme-color" content="#0f172a" \/>/);
  assert.match(html, /<title>Kütüphane Programı<\/title>/);
  assert.match(html, /<div id="root"><\/div>/);
});

test('Giriş dosyasındaki bileşen, CSS ve StrictMode kullanımı korunur', () => {
  assert.match(main, /import App from '\.\/kutuphaneprogramıguncell\.jsx';/);
  assert.match(main, /import '\.\/src\/index\.css';/);
  assert.match(main, /React\.StrictMode/);
  assert.ok(existsSync(resolve(root, 'kutuphaneprogramıguncell.jsx')));
});
