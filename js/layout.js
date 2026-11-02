// Card grid maths, straight from design/SPEC.md §2 and the Layout board.
// Pure functions so they can be unit-tested.

export const GRIDS = {
  land: { 6: [3, 2], 12: [4, 3], 16: [4, 4], 20: [5, 4] },
  port: { 6: [2, 3], 12: [3, 4], 16: [4, 4], 20: [4, 5] },
};

export const MAX_RATIO = 1.25; // cards stay between 4:5 and 5:4

/** Phone rules apply when the shorter side is under 600 px. */
export function isPhone(w, h) {
  return Math.min(w, h) < 600;
}

/**
 * @param {number} cardCount 6 | 12 | 16 | 20
 * @param {number} areaW card area width (already minus padding + safe areas)
 * @param {number} areaH card area height
 * @param {{landscape:boolean, phone:boolean}} mode
 */
export function fitGrid(cardCount, areaW, areaH, { landscape, phone }) {
  const table = landscape ? GRIDS.land : GRIDS.port;
  const [cols, rows] = table[cardCount] || table[12];
  const gap = phone ? 10 : cardCount <= 12 ? 20 : 16;
  const cellW = (areaW - (cols - 1) * gap) / cols;
  const cellH = (areaH - (rows - 1) * gap) / rows;
  const cardW = Math.max(0, Math.floor(Math.min(cellW, cellH * MAX_RATIO)));
  const cardH = Math.max(0, Math.floor(Math.min(cellH, cellW * MAX_RATIO)));
  return { cols, rows, gap, cardW, cardH };
}

/** Side padding / bottom space for a viewport, per SPEC §2. */
export function areaFor(w, h, headerBottom, bottomBar = 0) {
  const landscape = w > h;
  const phone = isPhone(w, h);
  const side = phone ? 16 : landscape ? 40 : 32;
  const bottom = phone ? (landscape ? 16 : 16) : landscape ? 24 : 32;
  return {
    landscape,
    phone,
    side,
    top: headerBottom,
    bottom: bottom + bottomBar,
  };
}
