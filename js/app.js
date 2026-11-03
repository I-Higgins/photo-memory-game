// Entry point: hash router + boot.
import { applySettings, watchSystem } from './settings.js';
import { takeScreenUrls, closeAllDialogs } from './ui.js';
import { registerServiceWorker } from './pwa.js';
import { renderHome } from './screens/home.js';
import { renderDifficulty } from './screens/difficulty.js';
import { renderGame, newRound, hasResumableRound } from './screens/play.js';
import { renderUnlock, renderHelperAlbums, renderHelperAlbum, isUnlocked } from './screens/helper.js';
import { renderSettings } from './screens/settings-screen.js';

const root = document.getElementById('app');
let leaveHandlers = [];
let mountHandlers = [];
let renderToken = 0;

const nav = {
  onLeave(fn) { leaveHandlers.push(fn); },
  afterMount(fn) { mountHandlers.push(fn); },
  refresh() { route(); },
};

function leave() {
  leaveHandlers.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  leaveHandlers = [];
  closeAllDialogs();
}

async function route() {
  const token = ++renderToken;
  leave();
  mountHandlers = [];
  const oldUrls = takeScreenUrls();
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  const holder = document.createElement('div');
  try {
    if (parts[0] === 'play' && parts.length === 3) {
      await renderDifficulty(holder, {
        type: parts[1], id: parts[2],
        startGame: (source, pairs) => { newRound(source, pairs); location.hash = '#/game'; },
      });
    } else if (parts[0] === 'game') {
      await renderGame(holder, nav);
    } else if (parts[0] === 'settings') {
      renderSettings(holder, { fromHelper: false });
    } else if (parts[0] === 'helper') {
      if (!isUnlocked() && parts.length > 1) { location.replace('#/helper'); return; }
      if (parts.length === 1) renderUnlock(holder);
      else if (parts[1] === 'albums') await renderHelperAlbums(holder, nav);
      else if (parts[1] === 'album' && parts[2]) await renderHelperAlbum(holder, nav, parts[2]);
      else if (parts[1] === 'settings') renderSettings(holder, { fromHelper: true });
      else { location.replace('#/helper/albums'); return; }
    } else {
      await renderHome(holder);
    }
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
    holder.innerHTML = '<main class="screen"><h1>Something went wrong</h1><p><a href="#/">Back to albums</a></p></main>';
  }
  if (token !== renderToken) return; // a newer navigation won
  oldUrls(); // revoke the previous screen's object URLs now that it's gone
  const view = holder.firstElementChild;
  if (view) root.replaceChildren(view);
  const mounted = mountHandlers;
  mountHandlers = [];
  mounted.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); // eslint-disable-line no-console
  document.title = titleFor(parts);
  if (!parts.length || parts[0] !== 'game') window.scrollTo(0, 0);
  root.dataset.route = parts[0] || 'home';
  window.dispatchEvent(new CustomEvent('pp:rendered', { detail: { route: hash } }));
}

function titleFor(parts) {
  const map = { game: 'Playing', settings: 'Settings', helper: 'Family helper', play: 'How many pairs?' };
  return parts[0] ? `${map[parts[0]] || 'Photo Pairs'} · Photo Pairs` : 'Photo Pairs';
}

applySettings();
watchSystem(() => {});
// No pinch or double-tap zoom: the viewport tag covers most of it; Safari also needs this.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
// Reopening the app carries on with an unfinished round.
if ((!location.hash || location.hash === '#/' || location.hash === '#') && hasResumableRound()) {
  history.replaceState(null, '', '#/game');
}
window.addEventListener('hashchange', route);
route();
registerServiceWorker();
