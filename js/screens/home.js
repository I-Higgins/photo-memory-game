import * as db from '../db.js';
import { packs } from '../starter-packs.js';
import { icon } from '../icons.js';
import { esc, el, plural, objectUrl, appMark, coverPlaceholder } from '../ui.js';
import { getSettings, setSettings } from '../settings.js';
import { MIN_PHOTOS } from '../game.js';
import { isStandalone } from '../pwa.js';

export async function renderHome(root) {
  const albums = await db.listAlbums().catch(() => []);
  const covers = {};
  for (const a of albums) {
    let pid = a.coverPhotoId;
    if (!pid && a.count) pid = (await db.listPhotos(a.id, false))[0]?.id;
    if (pid) {
      const p = await db.getPhoto(pid);
      if (p) covers[a.id] = objectUrl(p.thumb);
    }
  }
  const s = getSettings();
  const showInstall = !isStandalone() && !s.installDismissed;

  const albumTiles = albums.map((a) => {
    const cover = covers[a.id] ? `<img class="cover" src="${covers[a.id]}" alt="">` : coverPlaceholder();
    const count = plural(a.count, 'photo', 'photos');
    if (a.count < MIN_PHOTOS) {
      return `<div class="tile is-short" role="group" aria-label="${esc(a.name)}, ${count}. Needs at least ${MIN_PHOTOS} photos to play.">${cover}
        <div class="meta"><div><div class="name">${esc(a.name)}</div><div class="count">${count}</div></div>
        <span class="short-note">Needs ${MIN_PHOTOS} photos to play</span></div></div>`;
    }
    return `<a class="tile" href="#/play/album/${encodeURIComponent(a.id)}" aria-label="Play ${esc(a.name)}, ${count}">${cover}
      <div class="meta"><div><div class="name">${esc(a.name)}</div><div class="count">${count}</div></div>
      <span class="play-chip">${icon('play', 20)}Play</span></div></a>`;
  }).join('');

  const packTiles = packs().map((p) => `<a class="tile pack" href="#/play/pack/${p.id}" aria-label="Play ${esc(p.name)}, ${p.photos.length} pictures">
      <img src="${p.cover}" alt="">
      <div><div class="name">${esc(p.name)}</div><div class="count">${p.photos.length} pictures</div></div></a>`).join('');

  const view = el(`<main class="screen home">
    <header class="home-head">
      <div class="brand">${appMark(52)}<h1>Pick an album to play</h1></div>
      <nav class="home-actions" aria-label="More">
        <a class="btn btn-quiet btn-top" href="#/settings">${icon('settings', 24)}<span>Settings</span></a>
        <a class="btn btn-quiet btn-top" href="#/helper">${icon('lock', 24)}<span>Family helper</span></a>
      </nav>
    </header>
    ${showInstall ? `<section class="install" aria-labelledby="h-install">
      ${appMark(120)}
      <div class="body"><h2 id="h-install">Keep it on the Home Screen</h2>
        <ol>
          <li><span class="step-no">1</span><span>Tap Share <span class="share-ic">${icon('share', 26, 'style="vertical-align:-6px"')}</span> at the top of Safari</span></li>
          <li><span class="step-no">2</span><span>Choose “Add to Home Screen”</span></li>
          <li><span class="step-no">3</span><span>Open it once while on Wi‑Fi. After that it works without internet.</span></li>
        </ol></div>
      <button type="button" class="btn btn-quiet" data-act="not-now">Not now</button>
    </section>` : ''}
    <section class="section" aria-labelledby="h-albums">
      <h2 id="h-albums">Family albums</h2>
      ${albums.length ? `<div class="album-grid">${albumTiles}</div>` : `<div class="empty-albums">
        <img src="assets/app/album-placeholder.svg" alt="" width="112" height="80" style="border-radius:12px">
        <p><strong>No family albums yet</strong>Open Family helper to add photos from this iPad. Until then, try the starter pictures.</p></div>`}
    </section>
    <section class="section" aria-labelledby="h-packs">
      <h2 id="h-packs">Starter pictures</h2>
      <div class="pack-grid">${packTiles}</div>
    </section>
  </main>`);
  const nn = view.querySelector('[data-act="not-now"]');
  if (nn) nn.addEventListener('click', () => { setSettings({ installDismissed: true }); nn.closest('.install').remove(); });
  root.replaceChildren(view);
}
