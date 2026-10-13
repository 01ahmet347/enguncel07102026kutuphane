import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/version.js'), 'utf8');
const main = readFileSync(resolve(root, 'kutuphaneprogramıguncell.jsx'), 'utf8');
const script = readFileSync(resolve(root, 'scripts/write-version.js'), 'utf8');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

test('APP_VERSION kullanıcı tarafından iletilen 2026.10.07.1 sürümü olarak korunur', async () => {
  assert.match(source, /export const APP_VERSION = '2026\.10\.07\.1';/);
  const module = await import('../src/version.js');
  assert.equal(module.APP_VERSION, '2026.10.07.1');
  assert.equal(module.BUILD_COMMIT, 'local');
});

test('Ana React uygulaması sürümü korunan modülden alır', () => {
  assert.match(main, /import \{ APP_VERSION, BUILD_COMMIT \} from '\.\/src\/version\.js';/);
  assert.match(main, />Sürüm \{APP_VERSION\}<\/div>/);
});

test('Mevcut sürüm oluşturma betiği ve package.json derleme komutu uyumludur', () => {
  assert.match(script, /APP_VERSION = '\(\[\^'\]\+\)'/);
  assert.equal(pkg.scripts.build, 'node scripts/write-version.js && vite build');
  assert.equal(pkg.type, 'module');
});

test('Sürüm oluşturma betiği geçici klasörde orijinal sürümü ve Vercel commitini yazar', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sgm-version-'));
  try {
    mkdirSync(join(tmp, 'src'));
    mkdirSync(join(tmp, 'scripts'));
    mkdirSync(join(tmp, 'public'));
    writeFileSync(join(tmp, 'package.json'), '{"type":"module"}\n');
    writeFileSync(join(tmp, 'src/version.js'), source);
    writeFileSync(join(tmp, 'scripts/write-version.js'), script);
    execFileSync(process.execPath, [join(tmp, 'scripts/write-version.js')], {
      env: { ...process.env, VERCEL_GIT_COMMIT_SHA: 'testcommit123' },
      stdio: 'pipe'
    });
    const payload = JSON.parse(readFileSync(join(tmp, 'public/version.json'), 'utf8'));
    assert.deepEqual(payload, { version: '2026.10.07.1', commit: 'testcommit123' });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
