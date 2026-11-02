import { icon } from '../icons.js';
import { esc, el, switchHtml, bindSwitch } from '../ui.js';
import { getSettings, setSettings } from '../settings.js';
import { pairOptions } from '../game.js';
import { GRIDS } from '../layout.js';
import { loadSource } from '../sources.js';

const NOTES = { 3: 'A gentle start', 10: 'The most cards' };

export async function renderDifficulty(root, { type, id, startGame }) {
  const source = await loadSource(type, id);
  if (!source) { location.hash = '#/'; return; }
  const s = getSettings();
  const n = source.photos.length;
  const word = type === 'pack' ? 'pictures' : 'photos';
  const choices = pairOptions(n).map((o) => {
    const [cols, rows] = GRIDS.land[o.cards];
    const cell = Math.floor(Math.min((200 - (cols - 1) * 6) / cols, ((150 - (rows - 1) * 6) / rows) * 1.2));
    const cellH = Math.round(cell / 1.2);
    const last = s.lastPairs === o.pairs && o.enabled;
    const reason = o.enabled ? '' : `Needs ${o.pairs} ${word}. This album has ${n}.`;
    const aria = `${o.pairs} pairs, ${o.cards} cards${last ? ', played last time' : ''}${reason ? '. ' + reason : ''}`;
    return `<button type="button" class="choice" data-pairs="${o.pairs}" ${o.enabled ? '' : 'disabled'} aria-label="${esc(aria)}">
      <span class="mini" aria-hidden="true"><span class="mini-grid" style="grid-template-columns:repeat(${cols}, ${cell}px)">
        ${`<span style="width:${cell}px;height:${cellH}px"></span>`.repeat(o.cards)}</span></span>
      <span><span class="pairs" style="display:block">${o.pairs} pairs</span><span class="cards" style="display:block">${o.cards} cards</span></span>
      ${last ? '<span class="chip">Played last time</span>' : `<span class="note">${esc(reason || NOTES[o.pairs] || ' ')}</span>`}
    </button>`;
  }).join('');

  const view = el(`<main class="screen difficulty" style="gap:28px">
    <header class="topbar">
      <a class="btn btn-quiet btn-player btn-back" href="#/">${icon('back', 28)}<span>Back</span></a>
      <div class="title"><p class="sub">${esc(source.name)}</p><h1>How many pairs?</h1></div>
      <span></span>
    </header>
    <div class="choices">${choices}</div>
    <div class="peek-row">
      <div><div class="row-label" id="peek-label">Look at all the cards first</div>
      <div class="row-help">The photos show for a few seconds, then turn over.</div></div>
      ${switchHtml('peek-switch', 'peek-label', s.peek)}
    </div>
  </main>`);
  bindSwitch(view, 'peek-switch', (on) => setSettings({ peek: on }));
  view.querySelectorAll('.choice:not([disabled])').forEach((b) => b.addEventListener('click', () => {
    const pairs = Number(b.dataset.pairs);
    setSettings({ lastPairs: pairs });
    startGame(source, pairs);
  }));
  root.replaceChildren(view);
}
