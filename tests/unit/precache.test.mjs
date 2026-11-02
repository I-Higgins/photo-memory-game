import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { appFiles } from '../../scripts/app-files.mjs';

const sw = readFileSync('sw.js', 'utf8');
const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every app file is precached by the service worker', () => {
  const missing = appFiles().filter((f) => !list.includes(f));
  assert.deepEqual(missing, [], `Not precached: ${missing.join(', ')} (run node scripts/update-precache.mjs)`);
  assert.ok(list.includes('./'));
});

test('every precached file exists', () => {
  const gone = list.filter((f) => f !== './' && !existsSync(f));
  assert.deepEqual(gone, []);
});

test('design/ is never precached', () => {
  assert.ok(!list.some((f) => f.startsWith('design/')));
});

test('sw VERSION matches js/version.js', () => {
  const swv = sw.match(/const VERSION = '([^']+)'/)[1];
  const appv = readFileSync('js/version.js', 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(swv, appv);
});

test('every module the app imports is precached', () => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/from '(\.[^']+)'/g)) {
      const next = new URL(m[1], 'file:///' + file).pathname.slice(1);
      visit(next);
    }
  };
  visit('js/app.js');
  for (const f of seen) assert.ok(list.includes(f), `${f} not precached`);
});

test('index.html references only precached files', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) assert.ok(list.includes(m[1]), `${m[1]} not precached`);
});

test('manifest icons exist and are precached', () => {
  const man = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(man.start_url, './');
  assert.equal(man.scope, './');
  assert.equal(man.display, 'standalone');
  for (const i of man.icons) assert.ok(list.includes(i.src), i.src);
});
