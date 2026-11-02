import { icon } from '../icons.js';
import { esc, el, announce, openDialog } from '../ui.js';
import * as G from '../game.js';
import { fitGrid, isPhone } from '../layout.js';
import { getSettings, setSettings, MISMATCH_MS, reducedMotion, saveRoundText, loadRoundText, clearRound, getLastPhotos, setLastPhotos } from '../settings.js';
import { loadSource, imageUrls } from '../sources.js';
import { speak, chime } from '../speech.js';

const NUMBER_WORDS = { 3: 'Three', 6: 'Six', 8: 'Eight', 10: 'Ten' };
const ROTS = [-4, 3, -2, 4, -3, 2, -1, 3, -4, 2];
const TAP_GUARD_MS = 250; // a shaky double-touch can't turn two cards at once
const PEEK_SECONDS = 5;

/** Deal and save a fresh round; the router then shows #/game. */
export function newRound(source, pairs) {
  const last = getLastPhotos(source.key);
  const round = G.deal(source.photos.map((p) => p.id), pairs, {
    previousIds: last ? last.ids : [],
    previousLayout: last ? last.layout : null,
  });
  const ids = [...new Set(round.cards.map((c) => c.photoId))];
  setLastPhotos(source.key, ids, round.cards.map((c) => c.photoId));
  saveRoundText(G.serialise(round, { sourceType: source.type, sourceId: source.id, fresh: true }));
}

export function hasResumableRound() {
  const t = loadRoundText();
  const saved = t && G.restore(t);
  return !!(saved && !saved.round.done);
}

export function savedRoundSource() {
  const t = loadRoundText();
  const saved = t && G.restore(t);
  return saved ? { type: saved.sourceType, id: saved.sourceId } : null;
}

const motifSvg = '<svg viewBox="0 0 104 88" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="8" y="14" width="54" height="62" rx="6" transform="rotate(-9 35 45)" opacity=".55"/><rect x="40" y="10" width="54" height="62" rx="6" transform="rotate(8 67 41)"/><path d="M67 52c-7-5-11-9-11-13.5a5.5 5.5 0 0 1 11-1.5 5.5 5.5 0 0 1 11 1.5C78 43 74 47 67 52z" fill="currentColor"/></svg>';
const corners = [
  ['left:11px;top:11px', 'M0 0h28L0 28z'],
  ['right:11px;top:11px', 'M28 0H0l28 28z'],
  ['left:11px;bottom:11px', 'M0 28h28L0 0z'],
  ['right:11px;bottom:11px', 'M28 28H0L28 0z'],
].map(([pos, d]) => `<svg class="corner" style="${pos}" viewBox="0 0 28 28" aria-hidden="true"><path d="${d}"/></svg>`).join('');
const missingHtml = `<span class="missing">${icon('photo-error', 56)}<b>This photo couldn’t be shown</b><span>It still matches its pair</span></span>`;

export async function renderGame(root, nav) {
  const text = loadRoundText();
  const saved = text && G.restore(text);
  if (!saved) { location.hash = '#/'; return; }
  const source = await loadSource(saved.sourceType, saved.sourceId);
  if (!source) { clearRound(); location.hash = '#/'; return; }

  let round = saved.round;
  const captions = new Map(source.photos.map((p) => [p.id, p.caption]));
  const ids = [...new Set(round.cards.map((c) => c.photoId))];
  let urls = await imageUrls(source, ids);
  const settings = getSettings();
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  let peeking = false;
  let lastTap = 0;
  let momentOpen = false;
  let hintIdx = [];

  const save = () => saveRoundText(G.serialise(round, { sourceType: source.type, sourceId: source.id }));
  const cap = (pid) => captions.get(pid) || '';

  const view = el(`<div class="game" role="main">
    <header class="game-bar">
      <a class="btn btn-quiet btn-player btn-back" href="#/play/${source.type}/${encodeURIComponent(source.id)}" data-act="back">${icon('back', 28)}<span>Back</span></a>
      <div class="title"><h1>${esc(source.name)}</h1><p class="sub" role="status">Find the matching photos</p></div>
      <div class="tools" data-top-tools>
        <button type="button" class="btn btn-quiet btn-player" data-act="hint">${icon('hint', 26)}<span>Hint</span></button>
        <button type="button" class="btn btn-quiet btn-player" data-act="restart">${icon('restart', 26)}<span>Restart</span></button>
      </div>
      <button type="button" class="btn btn-primary ready" data-act="ready" hidden>I’m ready</button>
    </header>
    <div class="board"><div class="grid"></div></div>
    <nav class="game-bottom" aria-label="Game controls" hidden>
      <button type="button" class="btn btn-quiet btn-player" data-act="hint" data-tool>${icon('hint', 22)}<span>Hint</span></button>
      <button type="button" class="btn btn-quiet btn-player" data-act="restart" data-tool>${icon('restart', 22)}<span>Restart</span></button>
      <button type="button" class="btn btn-primary btn-player" data-act="ready" hidden>I’m ready</button>
    </nav>
  </div>`);
  const grid = view.querySelector('.grid');
  const board = view.querySelector('.board');
  const bar = view.querySelector('.game-bar');
  const sub = view.querySelector('.sub');
  const bottomNav = view.querySelector('.game-bottom');
  const topTools = view.querySelector('[data-top-tools]');
  const readyTop = bar.querySelector('[data-act="ready"]');
  const readyBottom = bottomNav.querySelector('[data-act="ready"]');
  let readyBtn = readyTop;

  // ---------- cards ----------
  function buildCards() {
    grid.replaceChildren(...round.cards.map((c, i) => {
      const u = urls.get(c.photoId);
      const b = el(`<button type="button" class="card" data-i="${i}">
        <span class="card-inner">
          <span class="face face-back" aria-hidden="true"><span class="frame"></span>${corners}<span class="motif">${motifSvg}</span></span>
          <span class="face face-front" aria-hidden="true">${u ? `<img src="${u.thumb}" alt="" draggable="false">` : missingHtml}<span class="badge">${icon('matched', 24, 'stroke-width="3"')}</span></span>
        </span></button>`);
      const img = b.querySelector('img');
      if (img) img.addEventListener('error', () => { img.replaceWith(el(missingHtml)); }, { once: true });
      b.addEventListener('click', () => onTap(i));
      return b;
    }));
    paint();
  }

  function paint() {
    const cards = grid.children;
    round.cards.forEach((c, i) => {
      const b = cards[i];
      const up = peeking || G.isUp(round, i);
      b.classList.toggle('is-up', up);
      b.classList.toggle('is-matched', c.matched);
      b.classList.toggle('is-picked', !peeking && round.up.length === 1 && round.up[0] === i);
      b.classList.toggle('is-hint', hintIdx.includes(i) && !c.matched);
      const name = cap(c.photoId) || 'Photo';
      b.setAttribute('aria-label', c.matched ? `Matched: ${name}` : up ? `Turned over: ${name}` : `Card ${i + 1}, face down`);
      if (c.matched) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    });
  }

  // ---------- layout (SPEC §2) ----------
  const probe = el('<div style="position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"></div>');
  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const phone = isPhone(w, h);
    const landscape = w > h;
    const cs = getComputedStyle(probe);
    const safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    const useBottom = phone && !landscape;
    view.classList.toggle('phone', phone);
    bottomNav.hidden = !useBottom;
    bottomNav.querySelectorAll('[data-tool]').forEach((b) => { b.hidden = peeking; });
    topTools.hidden = useBottom || peeking;
    readyTop.hidden = !peeking || useBottom;
    readyBottom.hidden = !peeking || !useBottom;
    readyBtn = useBottom ? readyBottom : readyTop;
    const side = phone ? 16 : landscape ? 40 : 32;
    view.style.setProperty('--side', side + 'px');
    const barBottom = bar.getBoundingClientRect().bottom;
    const top = phone ? barBottom + 16 : Math.max(safe.t + 120, barBottom + 12);
    let bottom;
    if (useBottom) bottom = safe.b + 4 + 64 + 16; // bottom bar (64) above the home indicator, then 16 clear
    else bottom = safe.b + (phone ? 16 : landscape ? 24 : 32);
    const left = side + safe.l;
    const right = side + safe.r;
    const areaW = w - left - right;
    const areaH = h - top - bottom;
    const f = fitGrid(round.cards.length, areaW, areaH, { landscape, phone });
    Object.assign(board.style, { left: left + 'px', right: right + 'px', top: top + 'px', height: Math.max(0, areaH) + 'px' });
    grid.style.gridTemplateColumns = `repeat(${f.cols}, ${f.cardW}px)`;
    grid.style.gap = f.gap + 'px';
    for (const b of grid.children) { b.style.width = f.cardW + 'px'; b.style.height = f.cardH + 'px'; }
  }
  let resizeT;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 100); };

  // ---------- play ----------
  function onTap(i) {
    if (peeking || momentOpen) return;
    const now = performance.now();
    if (now - lastTap < TAP_GUARD_MS) return;
    const { round: next, result } = G.flip(round, i);
    if (result === 'ignored') return;
    lastTap = now;
    round = next;
    hintIdx = [];
    paint();
    save();
    if (result === 'match') {
      const pid = round.cards[i].photoId;
      announce(`Pair found${cap(pid) ? ': ' + cap(pid) : ''}`);
      if (getSettings().sound) chime();
      momentOpen = true; // block taps until the moment is closed
      later(() => openMoment(pid), parseInt(cssVar('--delay-match-moment'), 10) || 650);
    } else if (result === 'mismatch') {
      later(() => { round = G.settleMismatch(round); paint(); save(); }, MISMATCH_MS[getSettings().mismatch] || 2000);
    }
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function openMoment(pid) {
    const u = urls.get(pid);
    const caption = cap(pid);
    const rm = reducedMotion();
    const ov = el(`<div class="overlay moment" role="dialog" aria-modal="true" aria-label="Pair found">
      <div class="mat">${u ? `<img src="${u.display}" alt="${esc(caption || 'Photo')}">` : missingHtml}</div>
      ${caption ? `<p class="caption">${esc(caption)}</p>` : ''}
      <div class="actions">
        ${getSettings().readAloud ? `<button type="button" class="btn btn-quiet btn-main" data-act="read">${icon('read-aloud', 28)}<span>Read aloud</span></button>` : ''}
        <button type="button" class="btn btn-primary btn-main" data-act="keep">Keep playing</button>
      </div>
      <div class="auto">${rm ? '' : '<div class="bar" aria-hidden="true"><div class="fill"></div></div>'}<p>Carries on by itself</p></div>
    </div>`);
    const img = ov.querySelector('img');
    if (img) img.addEventListener('error', () => img.replaceWith(el(missingHtml)), { once: true });
    const close = () => {
      if (!ov.isConnected) return;
      clearTimeout(auto);
      ov.remove();
      momentOpen = false;
      if (round.done) showComplete();
      else grid.children[0] && view.querySelector('.card:not([aria-disabled])')?.focus({ preventScroll: true });
    };
    const auto = later(close, parseInt(cssVar('--dur-moment-auto'), 10) || 6000);
    ov.querySelector('[data-act="keep"]').addEventListener('click', close);
    const rb = ov.querySelector('[data-act="read"]');
    if (rb) rb.addEventListener('click', () => speak(caption || ''));
    view.appendChild(ov);
    ov.querySelector('[data-act="keep"]').focus({ preventScroll: true });
  }

  function showComplete() {
    view.querySelector('.overlay.complete')?.remove();
    const found = round.found.length ? round.found : ids;
    const small = found.length > 6;
    const words = NUMBER_WORDS[round.pairs] || String(round.pairs);
    const ov = el(`<div class="overlay complete" role="dialog" aria-modal="true" aria-labelledby="done-t">
      <div class="head">${icon('heart', 48, 'style="color:var(--pick)"').replace('var(--heart)', 'var(--pick)')}
        <h2 id="done-t">You found every pair</h2>
        <p>${words} lovely memories from ${esc(source.name)}</p></div>
      <div class="collage${small ? ' small' : ''}">${found.map((pid, n) => {
        const u = urls.get(pid);
        return `<div class="polaroid" style="--rot:${ROTS[n % ROTS.length]}deg;animation-delay:${n * 80}ms">${u ? `<img src="${u.thumb}" alt="${esc(cap(pid) || 'Photo')}">` : `<div style="width:150px;height:130px">${missingHtml}</div>`}</div>`;
      }).join('')}</div>
      <div class="actions">
        <a class="btn btn-quiet btn-main" href="#/" data-act="another">Choose another album</a>
        <button type="button" class="btn btn-primary btn-main" data-act="again">Play again</button>
      </div></div>`);
    ov.querySelector('[data-act="another"]').addEventListener('click', () => clearRound());
    ov.querySelector('[data-act="again"]').addEventListener('click', () => restart());
    view.appendChild(ov);
    announce('You found every pair');
    ov.querySelector('[data-act="again"]').focus({ preventScroll: true });
  }

  async function restart() {
    clearTimers();
    view.querySelector('.overlay')?.remove();
    momentOpen = false;
    const fresh = await loadSource(source.type, source.id);
    if (!fresh || fresh.photos.length < round.pairs) { clearRound(); location.hash = '#/'; return; }
    newRound(fresh, round.pairs);
    const again = G.restore(loadRoundText());
    round = again.round;
    fresh.photos.forEach((p) => captions.set(p.id, p.caption));
    const newIds = [...new Set(round.cards.map((c) => c.photoId))];
    urls = await imageUrls(source, newIds);
    ids.splice(0, ids.length, ...newIds);
    hintIdx = [];
    buildCards();
    layout();
    save();
    if (getSettings().peek) startPeek(); else sub.textContent = 'Find the matching photos';
  }

  function askRestart() {
    if (momentOpen || peeking) return;
    const d = el(`<div aria-labelledby="restart-t">
      <h2 id="restart-t">Start this round again?</h2>
      <p style="margin-bottom:16px">The cards will be shuffled and turned face down.</p>
      <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0" style="min-height:68px">Keep playing</button>
      <button type="button" class="btn btn-primary btn-dialog" data-r="1" style="min-height:68px">Start again</button></div></div>`);
    const dlg = openDialog(d);
    d.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    d.querySelector('[data-r="1"]').addEventListener('click', () => { dlg.close(); restart(); });
  }

  function showHint() {
    if (momentOpen || peeking || G.isLocked(round)) return;
    hintIdx = [];
    paint();
    const pair = G.hintPair(round);
    if (!pair.length) return;
    requestAnimationFrame(() => {
      hintIdx = pair;
      paint();
      const ms = reducedMotion() ? 4000 : (parseInt(cssVar('--dur-hint'), 10) || 1300) * 3;
      later(() => { if (hintIdx === pair) { hintIdx = []; paint(); } }, ms);
    });
  }

  // ---------- peek ----------
  function startPeek() {
    peeking = true;
    let left = PEEK_SECONDS;
    sub.textContent = `Have a good look — turning over in ${left}`;
    layout();
    paint();
    readyBtn.focus({ preventScroll: true });
    const tick = () => {
      left -= 1;
      if (!peeking) return;
      if (left <= 0) { endPeek(); return; }
      sub.textContent = `Have a good look — turning over in ${left}`;
      later(tick, 1000);
    };
    later(tick, 1000);
  }
  function endPeek() {
    if (!peeking) return;
    clearTimers();
    peeking = false;
    sub.textContent = 'Find the matching photos';
    layout();
    const cards = [...grid.children];
    if (reducedMotion()) { paint(); }
    else {
      // flip down left → right with a 30 ms stagger
      round.cards.forEach((c, i) => later(() => {
        if (!G.isUp(round, i)) cards[i].classList.remove('is-up');
        if (i === round.cards.length - 1) paint();
      }, i * 30));
    }
  }

  function showHowTo(then) {
    const ov = el(`<div class="overlay howto" role="dialog" aria-modal="true" aria-label="How to play">
      <div class="steps" aria-hidden="true">
        <div class="panel"><span class="mc pick"><img src="assets/starter-packs/boats-and-fishing/sailing-boat.svg" alt=""></span><span class="mc down"></span>${hand(92)}</div>
        ${icon('back', 40, 'style="transform:rotate(180deg)"')}
        <div class="panel"><span class="mc pick"><img src="assets/starter-packs/boats-and-fishing/sailing-boat.svg" alt=""></span><span class="mc pick"><img src="assets/starter-packs/boats-and-fishing/sailing-boat.svg" alt=""></span>${hand(196)}</div>
        ${icon('back', 40, 'style="transform:rotate(180deg)"')}
        <div class="panel"><span class="mc done"><img src="assets/starter-packs/boats-and-fishing/sailing-boat.svg" alt=""></span><span class="mc done"><img src="assets/starter-packs/boats-and-fishing/sailing-boat.svg" alt=""></span><span class="tick">${icon('matched', 22, 'stroke-width="3"')}</span></div>
      </div>
      <button type="button" class="btn btn-primary btn-main" aria-label="Got it, start playing">${icon('matched', 26, 'stroke-width="3"')}<span>Got it</span></button>
    </div>`);
    ov.querySelector('button').addEventListener('click', () => { ov.remove(); setSettings({ howToSeen: true }); then(); });
    view.appendChild(ov);
    ov.querySelector('button').focus({ preventScroll: true });
  }
  function hand(left) {
    return `<svg class="hand" style="left:${left}px" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11l3.6.6a2 2 0 0 1 1.6 2.3l-.8 4.6A2 2 0 0 1 14.4 20H10a2 2 0 0 1-1.6-.8l-3-4a1.5 1.5 0 0 1 2.3-1.9L9 14.5z" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  }

  // ---------- wire up ----------
  view.querySelectorAll('[data-act="hint"]').forEach((b) => b.addEventListener('click', showHint));
  view.querySelectorAll('[data-act="restart"]').forEach((b) => b.addEventListener('click', askRestart));
  readyTop.addEventListener('click', endPeek);
  readyBottom.addEventListener('click', endPeek);

  root.replaceChildren(view);
  buildCards();
  const fresh = !!saved.fresh;
  if (fresh) save(); // drop the "fresh" flag so a reload resumes instead of re-peeking
  nav.afterMount(() => {
    document.body.appendChild(probe);
    layout();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (round.done) showComplete();
    else if (fresh) {
      const go = () => (settings.peek ? startPeek() : null);
      if (!getSettings().howToSeen) showHowTo(go); else go();
    }
  });

  nav.onLeave(() => {
    clearTimers();
    clearTimeout(resizeT);
    probe.remove();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* ignore */ }
    if (!round.done) save();
  });
}
