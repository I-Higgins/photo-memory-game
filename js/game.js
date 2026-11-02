// Pure game logic: dealing, the flip state machine, hints and save/restore.
// No DOM here so it runs under `node --test`.

export const PAIR_CHOICES = [3, 6, 8, 10];
export const MIN_PHOTOS = 3;

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Choose `pairs` photo ids from `photoIds`, preferring ones that weren't in
 * the previous round when the album is big enough.
 */
export function choosePhotos(photoIds, pairs, previousIds = [], rng = Math.random) {
  if (photoIds.length < pairs) throw new Error('Not enough photos');
  const prev = new Set(previousIds);
  const fresh = shuffle(photoIds.filter((id) => !prev.has(id)), rng);
  const used = shuffle(photoIds.filter((id) => prev.has(id)), rng);
  return fresh.concat(used).slice(0, pairs);
}

/**
 * Deal a new round. Returns a round object (plain JSON, safe to save).
 * @param {string[]} photoIds all ids available in the album/pack
 * @param {number} pairs
 * @param {{previousIds?: string[], previousLayout?: string[], rng?: () => number}} [opts]
 */
export function deal(photoIds, pairs, opts = {}) {
  const rng = opts.rng || Math.random;
  const chosen = choosePhotos(photoIds, pairs, opts.previousIds || [], rng);
  let order = shuffle(chosen.concat(chosen), rng);
  // Never the exact same layout twice in a row.
  const prevLayout = opts.previousLayout;
  for (let tries = 0; prevLayout && tries < 10 && sameLayout(order, prevLayout); tries++) {
    order = shuffle(order, rng);
  }
  return {
    v: 1,
    pairs,
    cards: order.map((photoId) => ({ photoId, matched: false })),
    up: [], // indices of face-up, unmatched cards (max 2)
    seen: {}, // photoId -> times a card of that pair was turned up
    found: [], // photoIds in the order they were matched
    done: false,
  };
}

function sameLayout(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Flip card `i`. Returns { round, result } where result is one of:
 *  'ignored'  – tap does nothing (matched, already up, or two cards showing)
 *  'first'    – first card of a pair turned up
 *  'match'    – second card matches
 *  'mismatch' – second card doesn't match; call settleMismatch() after the hold
 * Does not mutate the input.
 */
export function flip(round, i) {
  const card = round.cards[i];
  if (!card || round.done || card.matched) return { round, result: 'ignored' };
  if (round.up.length >= 2) return { round, result: 'ignored' }; // ignore the third tap
  if (round.up.includes(i)) return { round, result: 'ignored' }; // double tap on same card

  const next = clone(round);
  next.seen[card.photoId] = (next.seen[card.photoId] || 0) + 1;

  if (next.up.length === 0) {
    next.up = [i];
    return { round: next, result: 'first' };
  }
  const j = next.up[0];
  if (next.cards[j].photoId === card.photoId) {
    next.cards[i].matched = true;
    next.cards[j].matched = true;
    next.up = [];
    next.found.push(card.photoId);
    next.done = next.cards.every((c) => c.matched);
    return { round: next, result: 'match', pair: [j, i] };
  }
  next.up = [j, i];
  return { round: next, result: 'mismatch', pair: [j, i] };
}

/** After a mismatch hold: both cards turn back down. */
export function settleMismatch(round) {
  if (round.up.length < 2) return round;
  const next = clone(round);
  next.up = [];
  return next;
}

/** Is the card face up (matched or currently turned)? */
export function isUp(round, i) {
  return round.cards[i].matched || round.up.includes(i);
}

/** Can the player tap right now? (false while two unmatched cards show) */
export function isLocked(round) {
  return round.up.length >= 2;
}

/**
 * Pick a pair to hint at: the partner of a turned-up card, else the
 * unmatched pair turned over most often, else any unmatched pair.
 * Returns card indices of that pair (both cards), or [].
 */
export function hintPair(round, rng = Math.random) {
  const open = round.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.matched);
  if (!open.length) return [];
  let photoId;
  if (round.up.length === 1) {
    photoId = round.cards[round.up[0]].photoId;
  } else {
    let best = -1;
    const ids = shuffle([...new Set(open.map((x) => x.c.photoId))], rng);
    for (const id of ids) {
      const n = round.seen[id] || 0;
      if (n > best) { best = n; photoId = id; }
    }
  }
  return open.filter((x) => x.c.photoId === photoId).map((x) => x.i);
}

/** Serialise for localStorage. A round mid-mismatch is saved settled. */
export function serialise(round, meta = {}) {
  const r = round.up.length >= 2 ? settleMismatch(round) : round;
  return JSON.stringify({ ...meta, round: r });
}

/** Restore a saved round; returns null when the data is unusable. */
export function restore(text) {
  try {
    const data = JSON.parse(text);
    const r = data && data.round;
    if (!r || r.v !== 1 || !Array.isArray(r.cards) || !r.cards.length) return null;
    const counts = {};
    for (const c of r.cards) {
      if (typeof c.photoId !== 'string') return null;
      counts[c.photoId] = (counts[c.photoId] || 0) + 1;
    }
    if (Object.values(counts).some((n) => n !== 2)) return null;
    r.up = Array.isArray(r.up) ? r.up.filter((i) => r.cards[i] && !r.cards[i].matched).slice(0, 1) : [];
    r.seen = r.seen || {};
    r.found = Array.isArray(r.found) ? r.found : [];
    r.done = r.cards.every((c) => c.matched);
    return { ...data, round: r };
  } catch {
    return null;
  }
}

/** Which pair counts can be played with `photoCount` photos? */
export function pairOptions(photoCount) {
  return PAIR_CHOICES.map((pairs) => ({ pairs, cards: pairs * 2, enabled: photoCount >= pairs }));
}

function clone(round) {
  return {
    ...round,
    cards: round.cards.map((c) => ({ ...c })),
    up: round.up.slice(),
    seen: { ...round.seen },
    found: round.found.slice(),
  };
}
