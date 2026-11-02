import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitGrid, isPhone } from '../../js/layout.js';

// The table in design/SPEC.md §2.
const TABLE = {
  land: { 6: [3, 2, 353, 328], 12: [4, 3, 260, 212], 16: [4, 4, 196, 157], 20: [5, 4, 196, 157] },
  port: { 6: [2, 3, 368, 329], 12: [3, 4, 238, 242], 16: [4, 4, 177, 221], 20: [4, 5, 177, 192] },
  phone: { 6: [2, 3, 174, 193], 12: [3, 4, 112, 140], 16: [4, 4, 82, 102], 20: [4, 5, 82, 102] },
};
const AREA = { land: [1100, 676], port: [756, 1028], phone: [358, 599] };

for (const dev of Object.keys(TABLE)) {
  for (const [n, [cols, rows, w, h]] of Object.entries(TABLE[dev])) {
    test(`${dev} ${n} cards → ${cols}×${rows}, ${w}×${h}`, () => {
      const f = fitGrid(Number(n), ...AREA[dev], { landscape: dev === 'land', phone: dev === 'phone' });
      assert.deepEqual([f.cols, f.rows, f.cardW, f.cardH], [cols, rows, w, h]);
    });
  }
}

test('phone rules when the shorter side is under 600', () => {
  assert.ok(isPhone(390, 844));
  assert.ok(isPhone(844, 390));
  assert.ok(!isPhone(768, 1024));
});
