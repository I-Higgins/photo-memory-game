// Small preferences in localStorage (photos never go here).

const KEY = 'photo-pairs:settings';
const DEFAULTS = {
  textSize: 'normal', // normal | large | xl
  theme: null, // null = follow the system (light/dark) | light | dark | contrast
  peek: true,
  mismatch: 'medium', // short | medium | long
  readAloud: false,
  sound: false,
  code: null, // 4-digit string when the helper code is on
  lastPairs: null,
  lastBackup: null,
  installDismissed: false,
  howToSeen: false,
};

export const MISMATCH_MS = { short: 1200, medium: 2000, long: 3200 };

let cache;

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc. */ }
}

export function getSettings() {
  if (!cache) {
    let stored = {};
    try { stored = JSON.parse(safeGet(KEY) || '{}') || {}; } catch { stored = {}; }
    cache = { ...DEFAULTS, ...stored };
  }
  return cache;
}

export function setSettings(changes) {
  cache = { ...getSettings(), ...changes };
  safeSet(KEY, JSON.stringify(cache));
  applySettings();
  return cache;
}

const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function effectiveTheme() {
  const s = getSettings();
  if (s.theme) return s.theme;
  return darkQuery && darkQuery.matches ? 'dark' : 'light';
}

export function reducedMotion() {
  return !!(motionQuery && motionQuery.matches);
}

export function applySettings() {
  const s = getSettings();
  const root = document.documentElement;
  const theme = effectiveTheme();
  if (theme === 'light') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  if (s.textSize === 'normal') root.removeAttribute('data-text');
  else root.setAttribute('data-text', s.textSize);
  root.classList.toggle('reduce-motion', reducedMotion());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#F4EFE7');
}

export function watchSystem(onChange) {
  const cb = () => { applySettings(); onChange && onChange(); };
  darkQuery && darkQuery.addEventListener && darkQuery.addEventListener('change', cb);
  motionQuery && motionQuery.addEventListener && motionQuery.addEventListener('change', cb);
}

// The in-progress round lives here too: it's small JSON (ids + flags).
const ROUND_KEY = 'photo-pairs:round';
export function saveRoundText(text) { safeSet(ROUND_KEY, text); }
export function loadRoundText() { return safeGet(ROUND_KEY); }
export function clearRound() { try { localStorage.removeItem(ROUND_KEY); } catch { /* ignore */ } }

const LAST_KEY = 'photo-pairs:last-photos';
export function getLastPhotos(sourceId) {
  try { return (JSON.parse(safeGet(LAST_KEY) || '{}') || {})[sourceId] || null; } catch { return null; }
}
export function setLastPhotos(sourceId, ids, layout) {
  let all = {};
  try { all = JSON.parse(safeGet(LAST_KEY) || '{}') || {}; } catch { all = {}; }
  all[sourceId] = { ids, layout };
  safeSet(LAST_KEY, JSON.stringify(all));
}
