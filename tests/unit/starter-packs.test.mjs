import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { packs, allPackFiles } from '../../js/starter-packs.js';

test('four packs of ten pictures, all files present', () => {
  assert.equal(packs().length, 4);
  for (const p of packs()) {
    assert.equal(p.photos.length, 10);
    assert.ok(existsSync(p.cover), p.cover);
  }
  for (const f of allPackFiles()) assert.ok(existsSync(f), f);
});
