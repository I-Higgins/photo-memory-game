import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../js/game.js';

function seeded(seed = 1) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const ids = (n) => Array.from({ length: n }, (_, i) => `p${i}`);

test('shuffle is a permutation', () => {
  const a = ids(20);
  const b = G.shuffle(a, seeded(7));
  assert.deepEqual([...b].sort(), [...a].sort());
  assert.notDeepEqual(b, a);
});

for (const pairs of G.PAIR_CHOICES) {
  test(`deal ${pairs} pairs: right count, each photo exactly twice`, () => {
    const r = G.deal(ids(12), pairs, { rng: seeded(pairs) });
    assert.equal(r.cards.length, pairs * 2);
    const counts = {};
    r.cards.forEach((c) => { counts[c.photoId] = (counts[c.photoId] || 0) + 1; });
    assert.equal(Object.keys(counts).length, pairs);
    assert.ok(Object.values(counts).every((n) => n === 2));
    assert.ok(r.cards.every((c) => c.matched === false));
  });
}

test('deal refuses when the album is too small', () => {
  assert.throws(() => G.deal(ids(4), 6));
});

test('avoids repeating the previous photos when the album is big enough', () => {
  const all = ids(12);
  const first = G.deal(all, 6, { rng: seeded(3) });
  const prev = [...new Set(first.cards.map((c) => c.photoId))];
  const second = G.deal(all, 6, { previousIds: prev, rng: seeded(4) });
  const now = new Set(second.cards.map((c) => c.photoId));
  assert.ok(prev.every((id) => !now.has(id)));
});

test('reuses some photos only when it must', () => {
  const all = ids(8);
  const prev = ids(6);
  const r = G.deal(all, 6, { previousIds: prev, rng: seeded(5) });
  const now = new Set(r.cards.map((c) => c.photoId));
  assert.ok(now.has('p6') && now.has('p7'));
});

test('never deals the exact same layout twice in a row', () => {
  const all = ids(3);
  const rng = seeded(9);
  let prev = null;
  for (let i = 0; i < 50; i++) {
    const r = G.deal(all, 3, { previousLayout: prev, rng });
    const layout = r.cards.map((c) => c.photoId);
    if (prev) assert.notDeepEqual(layout, prev);
    prev = layout;
  }
});

function fixed(order) {
  return { v: 1, pairs: order.length / 2, cards: order.map((photoId) => ({ photoId, matched: false })), up: [], seen: {}, found: [], done: false };
}

test('first card, then match', () => {
  let r = fixed(['a', 'b', 'a', 'b']);
  let x = G.flip(r, 0);
  assert.equal(x.result, 'first');
  r = x.round;
  assert.deepEqual(r.up, [0]);
  x = G.flip(r, 2);
  assert.equal(x.result, 'match');
  assert.ok(x.round.cards[0].matched && x.round.cards[2].matched);
  assert.deepEqual(x.round.up, []);
  assert.deepEqual(x.round.found, ['a']);
});

test('mismatch keeps both up, then settles face down', () => {
  let r = fixed(['a', 'b', 'a', 'b']);
  r = G.flip(r, 0).round;
  const x = G.flip(r, 1);
  assert.equal(x.result, 'mismatch');
  assert.deepEqual(x.round.up, [0, 1]);
  assert.ok(G.isLocked(x.round));
  const s = G.settleMismatch(x.round);
  assert.deepEqual(s.up, []);
  assert.ok(!G.isUp(s, 0) && !G.isUp(s, 1));
});

test('ignores the third tap while two unmatched cards show', () => {
  let r = fixed(['a', 'b', 'c', 'a', 'b', 'c']);
  r = G.flip(r, 0).round;
  r = G.flip(r, 1).round; // mismatch
  const x = G.flip(r, 2);
  assert.equal(x.result, 'ignored');
  assert.equal(x.round, r);
  assert.equal(r.up.length, 2);
});

test('ignores a double tap on the same card and taps on matched cards', () => {
  let r = fixed(['a', 'b', 'a', 'b']);
  r = G.flip(r, 0).round;
  assert.equal(G.flip(r, 0).result, 'ignored');
  r = G.flip(r, 2).round; // match
  assert.equal(G.flip(r, 0).result, 'ignored');
  assert.equal(G.flip(r, 2).result, 'ignored');
});

test('flip does not mutate its input', () => {
  const r = fixed(['a', 'b', 'a', 'b']);
  const snapshot = JSON.stringify(r);
  G.flip(r, 0);
  assert.equal(JSON.stringify(r), snapshot);
});

test('round completes when every pair is found', () => {
  let r = fixed(['a', 'b', 'a', 'b']);
  r = G.flip(G.flip(r, 0).round, 2).round;
  assert.equal(r.done, false);
  r = G.flip(G.flip(r, 1).round, 3).round;
  assert.equal(r.done, true);
});

test('hint picks the partner of a turned-up card', () => {
  let r = fixed(['a', 'b', 'c', 'a', 'b', 'c']);
  r = G.flip(r, 1).round;
  assert.deepEqual(G.hintPair(r).sort(), [1, 4]);
});

test('hint otherwise picks the most-seen unmatched pair', () => {
  let r = fixed(['a', 'b', 'c', 'a', 'b', 'c']);
  r = G.settleMismatch(G.flip(G.flip(r, 2).round, 0).round); // saw c and a
  r = G.settleMismatch(G.flip(G.flip(r, 5).round, 1).round); // saw c and b
  assert.deepEqual(G.hintPair(r).sort(), [2, 5]);
});

test('resume from saved state', () => {
  let r = fixed(['a', 'b', 'c', 'a', 'b', 'c']);
  r = G.flip(G.flip(r, 0).round, 3).round; // match a
  r = G.flip(r, 1).round; // first card b
  const text = G.serialise(r, { sourceType: 'pack', sourceId: 'cars' });
  const back = G.restore(text);
  assert.equal(back.sourceType, 'pack');
  assert.equal(back.sourceId, 'cars');
  assert.deepEqual(back.round.cards, r.cards);
  assert.deepEqual(back.round.up, [1]);
  const x = G.flip(back.round, 4);
  assert.equal(x.result, 'match');
});

test('a round saved mid-mismatch resumes with both cards face down', () => {
  let r = fixed(['a', 'b', 'a', 'b']);
  r = G.flip(G.flip(r, 0).round, 1).round;
  const back = G.restore(G.serialise(r));
  assert.deepEqual(back.round.up, []);
});

test('restore rejects broken data', () => {
  assert.equal(G.restore('nope'), null);
  assert.equal(G.restore(JSON.stringify({ round: { v: 1, cards: [{ photoId: 'a' }] } })), null);
  assert.equal(G.restore(JSON.stringify({ round: { v: 2, cards: [] } })), null);
});

test('pair options are disabled when the album is too small', () => {
  const o = G.pairOptions(7);
  assert.deepEqual(o.map((x) => x.enabled), [true, true, false, false]);
});
