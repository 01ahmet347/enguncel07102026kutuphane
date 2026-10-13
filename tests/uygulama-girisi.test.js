import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(resolve(root, 'main.js'), 'utf8');
const app = readFileSync(resolve(root, 'kutuphaneprogramıguncell.jsx'), 'utf8');

test('Ana giriş dosyası gerçek bileşen adını içe aktarır', () => {
  assert.match(main, /import App from '\.\/kutuphaneprogramıguncell\.jsx';/);
  assert.ok(existsSync(resolve(root, 'kutuphaneprogramıguncell.jsx')));
  assert.match(app, /export default function App\(\)/);
});

test('Kullanıcının React StrictMode ve CSS çağrısı korunur', () => {
  assert.match(main, /React\.StrictMode/);
  assert.match(main, /import '\.\/src\/index\.css';/);
  assert.match(main, /createRoot\(document\.getElementById\('root'\)\)/);
});

test('Ana JSX modül çağrıları kök klasör varsayımıyla uyumludur', () => {
  assert.match(app, /from '\.\/src\/cloud-transactions\.js'/);
  assert.match(app, /from '\.\/src\/sync-core\.js'/);
  assert.match(app, /from '\.\/src\/version\.js'/);
  assert.ok(existsSync(resolve(root, 'src/cloud-transactions.js')));
});
