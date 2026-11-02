import * as db from '../db.js';
import { icon } from '../icons.js';
import { esc, el, plural, objectUrl, openDialog, confirmDialog, placeholderArt, announce } from '../ui.js';
import { getSettings, setSettings, clearRound } from '../settings.js';
import { processImage } from '../images.js';
import { buildBackup, backupFileName, saveFile, restoreBackup } from '../backup.js';
import { requestPersist, isPersisted, storageEstimate } from '../pwa.js';
import { savedRoundSource } from './play.js';

// Unlocking only guards against accidents; it isn't security.
let unlocked = false;
export const isUnlocked = () => unlocked;
export const lock = () => { unlocked = false; };

const HOLD_MS = 2000;
const FORGOT_HOLD_MS = 10000;
const CIRC = 678.6;

// ---------------------------------------------------------------- unlock
export function renderUnlock(root) {
  const s = getSettings();
  let mode = s.code ? 'code' : 'hold';
  let holdMs = HOLD_MS;
  let code = '';

  const view = el(`<main class="screen unlock">
    <div><a class="btn btn-quiet btn-player btn-back" href="#/">${icon('back', 28)}<span>Back to albums</span></a></div>
    <div class="unlock-body">
      <h1>Family helper</h1>
      <p>Add photos, write captions and change settings. Kept separate so nothing gets deleted by accident. (This lock only prevents accidents; it isn’t a security lock.)</p>
      <div data-area></div>
    </div>
  </main>`);
  const area = view.querySelector('[data-area]');

  function unlockedNow(turnCodeOff) {
    unlocked = true;
    if (turnCodeOff) setSettings({ code: null });
    announce('Unlocked');
    const go = el(`<a class="btn btn-primary btn-main" href="#/helper/albums" style="margin-top:8px">Open the helper area</a>`);
    area.appendChild(go);
    go.focus();
  }

  function holdView() {
    const secs = holdMs / 1000;
    area.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
      <button type="button" class="hold" aria-label="Press and hold for ${secs} seconds to open the helper area">
        <svg class="ring" aria-hidden="true" width="240" height="240" viewBox="0 0 240 240"><circle class="track" cx="120" cy="120" r="108" fill="none" stroke-width="12"/><circle class="prog" cx="120" cy="120" r="108" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" transform="rotate(-90 120 120)"/></svg>
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path data-shackle d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        <span class="lbl">Press and hold</span>
      </button>
      <p class="hold-msg" role="status">Hold for ${secs} seconds</p></div>`;
    const btn = area.querySelector('.hold');
    const prog = area.querySelector('.prog');
    const msg = area.querySelector('.hold-msg');
    let start = 0;
    let raf = 0;
    let done = false;
    const frame = () => {
      const p = Math.min(1, (performance.now() - start) / holdMs);
      prog.setAttribute('stroke-dashoffset', (CIRC * (1 - p)).toFixed(1));
      if (p >= 1) {
        done = true;
        area.querySelector('[data-shackle]').setAttribute('d', 'M8 11V8a4 4 0 0 1 7.5-2');
        btn.querySelector('.lbl').textContent = 'Unlocked';
        msg.textContent = 'Unlocked';
        unlockedNow(holdMs === FORGOT_HOLD_MS);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const down = (e) => {
      if (done) return;
      if (e.type === 'keydown' && (e.repeat || (e.key !== ' ' && e.key !== 'Enter'))) return;
      e.preventDefault();
      start = performance.now();
      msg.textContent = 'Keep holding…';
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    const up = () => {
      if (done || !start) return;
      cancelAnimationFrame(raf);
      start = 0;
      prog.setAttribute('stroke-dashoffset', String(CIRC));
      msg.textContent = 'Keep holding until the circle is full';
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('keydown', down);
    ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((t) => btn.addEventListener(t, up));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => e.preventDefault());
  }

  function codeView() {
    area.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:18px">
      <div class="dots" role="status" aria-label="0 of 4 digits entered"><span></span><span></span><span></span><span></span></div>
      <p class="code-msg">Enter the 4-digit code</p>
      <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => k === '' ? '<span></span>' :
        `<button type="button" class="key" data-k="${k}" aria-label="${k === 'del' ? 'Delete' : k}">${k === 'del' ? '⌫' : k}</button>`).join('')}</div>
      <button type="button" class="btn-link" data-forgot>Forgot the code?</button></div>`;
    const dots = area.querySelector('.dots');
    const msg = area.querySelector('.code-msg');
    const paint = () => {
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i < code.length));
      dots.setAttribute('aria-label', `${code.length} of 4 digits entered`);
    };
    area.querySelectorAll('.key').forEach((b) => b.addEventListener('click', () => {
      if (unlocked) return;
      const k = b.dataset.k;
      if (k === 'del') { code = code.slice(0, -1); msg.textContent = ''; paint(); return; }
      if (code.length >= 4) return;
      code += k;
      paint();
      if (code.length < 4) return;
      if (code === getSettings().code) { msg.textContent = 'Unlocked'; unlockedNow(false); }
      else { msg.textContent = 'That code didn’t work. Try again.'; setTimeout(() => { code = ''; paint(); }, 700); }
    }));
    area.querySelector('[data-forgot]').addEventListener('click', () => {
      const d = el(`<div class="wide" aria-labelledby="fg"><h2 id="fg">Forgot the code?</h2>
        <p>Press and hold the lock for 10 seconds instead. That opens the helper area and turns the code off, so you can set a new one in Settings. Your photos stay safe.</p>
        <button type="button" class="btn btn-primary btn-dialog" style="margin-top:10px;flex:none">OK</button></div>`);
      const dlg = openDialog(d, { onClose: () => { mode = 'hold'; holdMs = FORGOT_HOLD_MS; holdView(); } });
      d.querySelector('button').addEventListener('click', () => dlg.close());
    });
  }

  root.replaceChildren(view);
  if (mode === 'code') codeView(); else holdView();
}

// ---------------------------------------------------------------- albums
export async function renderHelperAlbums(root, nav) {
  const albums = await db.listAlbums();
  const total = albums.reduce((n, a) => n + a.count, 0);
  const covers = {};
  for (const a of albums) {
    const pid = a.coverPhotoId || (a.count ? (await db.listPhotos(a.id, false))[0]?.id : null);
    const p = pid ? await db.getPhoto(pid) : null;
    if (p) covers[a.id] = objectUrl(p.thumb);
  }
  const est = await storageEstimate();
  const persisted = await isPersisted();
  const s = getSettings();

  const view = el(`<main class="screen helper-albums">
    <header class="helper-head">
      <a class="btn btn-quiet btn-head" href="#/" data-act="lock" style="padding:0 22px">${icon('lock', 22)}<span>Done, lock again</span></a>
      <h1>Family helper</h1>
      <a class="btn btn-quiet btn-head" href="#/helper/settings" style="padding:0 22px">${icon('settings', 22)}<span>Settings</span></a>
    </header>
    <div class="helper-cols">
      <section class="panel albums-panel" aria-labelledby="h-al">
        <div class="ph"><h2 id="h-al">Albums</h2>
          <button type="button" class="btn btn-primary btn-helper" data-act="new">${icon('add', 20)}<span>New album</span></button></div>
        ${albums.length ? albums.map((a) => `<div class="arow" data-id="${esc(a.id)}">
          ${covers[a.id] ? `<img class="thumb" src="${covers[a.id]}" alt="">` : `<span class="thumb" style="display:flex;align-items:center;justify-content:center">${placeholderArt(48, 42, { heart: false, stroke: 5 })}</span>`}
          <a class="open" href="#/helper/album/${encodeURIComponent(a.id)}"><b>${esc(a.name)}</b><span>${plural(a.count, 'photo', 'photos')} · tap to open</span></a>
          <span class="acts">
            <button type="button" class="btn btn-quiet btn-helper" data-act="rename">Rename</button>
            <a class="btn btn-quiet btn-helper" href="#/helper/album/${encodeURIComponent(a.id)}">Cover</a>
            <button type="button" class="btn btn-danger-quiet btn-helper" data-act="delete">${icon('delete', 20)}<span>Delete</span></button>
          </span></div>`).join('') : `<p class="muted">No albums yet. Tap “New album” to make one, then add photos to it.</p>`}
      </section>
      <div class="side">
        <section class="panel" aria-labelledby="h-st">
          <h2 id="h-st">Storage</h2>
          <p class="storage-line">${plural(total, 'photo', 'photos')} saved on this iPad</p>
          ${est && est.quota ? `<div class="bar" aria-hidden="true"><div style="width:${Math.max(1, Math.min(100, Math.round((100 * est.usage) / est.quota)))}%"></div></div>` : ''}
          <p class="muted">${storageWords(est)}</p>
          <p class="muted" data-persist>${persistWords(persisted)}</p>
        </section>
        <section class="panel" aria-labelledby="h-bk">
          <h2 id="h-bk">Back up</h2>
          <p class="why">The photos are only kept in this app on this iPad. If Safari’s website data is cleared, or the app is removed, they are lost. A backup file keeps a copy you can put back.</p>
          <p class="muted">Last backup: ${s.lastBackup ? ago(s.lastBackup) : 'never'}</p>
          <button type="button" class="btn btn-primary btn-wide" data-act="backup" ${albums.length ? '' : 'disabled'}>${icon('back-up', 24)}<span>Back up an album</span></button>
          <button type="button" class="btn btn-quiet btn-wide" data-act="restore">${icon('restore', 24)}<span>Restore from a backup file</span></button>
          <input type="file" accept=".zip,application/zip" data-restore-input hidden>
        </section>
      </div>
    </div>
  </main>`);

  view.querySelector('[data-act="lock"]').addEventListener('click', () => lock());
  view.querySelector('[data-act="new"]').addEventListener('click', () => nameDialog(null, async (name) => {
    const a = await db.createAlbum(name);
    await requestPersist();
    location.hash = `#/helper/album/${encodeURIComponent(a.id)}`;
  }));
  view.querySelectorAll('.arow').forEach((row) => {
    const a = albums.find((x) => x.id === row.dataset.id);
    row.querySelector('[data-act="rename"]').addEventListener('click', () => nameDialog(a, async (name) => {
      await db.putAlbum({ ...a, name });
      nav.refresh();
    }));
    row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete “${a.name}”?`,
        text: `This removes the album and its ${plural(a.count, 'photo', 'photos')} from this iPad. It can’t be undone. Back it up first if you might want it again.`,
        cancel: 'Keep album', action: 'Delete album', danger: true, alert: true, wide: true,
      });
      if (!ok) return;
      await db.deleteAlbum(a.id);
      const sr = savedRoundSource();
      if (sr && sr.type === 'album' && sr.id === a.id) clearRound();
      announce(`Deleted ${a.name}`);
      nav.refresh();
    });
  });
  view.querySelector('[data-act="backup"]').addEventListener('click', () => backupFlow(albums, nav));
  const input = view.querySelector('[data-restore-input]');
  view.querySelector('[data-act="restore"]').addEventListener('click', () => restoreFlow(input, nav));
  root.replaceChildren(view);
  if (albums.length && persisted === false) {
    requestPersist().then((p) => { const n = view.querySelector('[data-persist]'); if (n) n.textContent = persistWords(p); });
  }
}

function storageWords(est) {
  if (!est || !est.quota) return 'This browser doesn’t say how much room is left.';
  const used = mb(est.usage);
  const free = est.quota - est.usage;
  const room = free > 2e9 ? 'This iPad has plenty of room left.' : free > 200e6 ? `About ${mb(free)} of room left.` : `Only about ${mb(free)} of room left.`;
  return `Using about ${used}. ${room}`;
}
function persistWords(p) {
  if (p === true) return 'Storage is set to keep: the iPad won’t clear these photos to save space.';
  if (p === false) return 'Storage isn’t marked to keep yet, so the iPad could clear it if space runs low. Keep a backup.';
  return 'This browser doesn’t say whether storage is kept. Keep a backup.';
}
function mb(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}
function ago(t) {
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function nameDialog(album, onSave) {
  const d = el(`<div class="wide" aria-labelledby="dn">
    <h2 id="dn">${album ? 'Rename album' : 'New album'}</h2>
    <label for="album-name">Album name</label>
    <input id="album-name" class="text-input" type="text" maxlength="40" autocomplete="off" placeholder="For example: Fishing trips" value="${esc(album ? album.name : '')}" style="font-size:calc(var(--fs-body) + 4px);min-height:64px;padding:0 18px">
    <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
    <button type="button" class="btn btn-primary btn-dialog" data-r="1">Save</button></div></div>`);
  const dlg = openDialog(d);
  const input = d.querySelector('input');
  const save = async () => {
    const name = input.value.trim() || (album ? album.name : 'New album');
    dlg.close();
    await onSave(name);
  };
  d.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
  d.querySelector('[data-r="1"]').addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

// ---------------------------------------------------------------- backup / restore
function backupFlow(albums, nav) {
  let chosen = albums.length === 1 ? [albums[0].id] : null;
  const d = el(`<div class="wide" aria-labelledby="db"><h2 id="db"></h2><div data-body style="display:flex;flex-direction:column;gap:14px"></div></div>`);
  const title = d.querySelector('h2');
  const body = d.querySelector('[data-body]');
  const dlg = openDialog(d);
  let built = null;

  function step1() {
    title.textContent = albums.length === 1 ? `Back up “${albums[0].name}”` : 'Back up an album';
    body.innerHTML = `<p>This makes one file with the album’s photos and captions. Save it to Files, iCloud Drive or email it to yourself.</p>
      ${albums.length > 1 ? `<div class="choose-list" role="radiogroup" aria-labelledby="db">
        ${albums.map((a) => `<button type="button" class="btn btn-quiet" role="radio" aria-checked="false" data-id="${esc(a.id)}">${esc(a.name)} · ${plural(a.count, 'photo', 'photos')}</button>`).join('')}
        <button type="button" class="btn btn-quiet" role="radio" aria-checked="false" data-id="*">All albums</button></div>` : ''}
      <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
      <button type="button" class="btn btn-primary btn-dialog" data-r="1" ${chosen ? '' : 'disabled'}>Make backup file</button></div>`;
    const go = body.querySelector('[data-r="1"]');
    body.querySelectorAll('[role="radio"]').forEach((b) => b.addEventListener('click', () => {
      body.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      chosen = b.dataset.id === '*' ? albums.map((a) => a.id) : [b.dataset.id];
      go.disabled = false;
    }));
    body.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    go.addEventListener('click', build);
  }

  async function build() {
    body.innerHTML = `<div class="adding" style="padding:0;border:0"><svg class="spin" aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3a9 9 0 1 1-9 9"/></svg>
      <div style="flex:1"><div class="t" role="status">Making the backup file…</div><div class="bar" aria-hidden="true"><div style="width:0%"></div></div></div></div>`;
    const fill = body.querySelector('.bar > div');
    try {
      const { blob, albums: inFile } = await buildBackup(chosen, (n, t) => { fill.style.width = Math.round((100 * n) / t) + '%'; });
      built = { blob, name: backupFileName(inFile) };
      step2();
    } catch {
      title.textContent = 'The backup couldn’t be made';
      body.innerHTML = `<p>Something went wrong while reading the photos. Nothing was changed. Try again, or try one album at a time.</p>
        <div class="row"><button type="button" class="btn btn-primary btn-dialog" data-r="0">OK</button></div>`;
      body.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    }
  }

  function step2() {
    // A separate tap keeps the share sheet inside a user gesture on iPad.
    title.textContent = 'Backup ready';
    body.innerHTML = `<p>${esc(built.name)} is ready. Save it somewhere safe, away from this iPad if you can.</p>
      <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
      <button type="button" class="btn btn-primary btn-dialog" data-r="1">${icon('share', 24)}<span>Save backup file</span></button></div>`;
    body.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
    body.querySelector('[data-r="1"]').addEventListener('click', async () => {
      const r = await saveFile(built.blob, built.name);
      if (r === 'cancelled') return;
      setSettings({ lastBackup: Date.now() });
      title.textContent = 'Backup saved';
      body.innerHTML = `<p>${esc(built.name)} is ready. Keep it somewhere safe, away from this iPad if you can.</p>
        <div class="row"><button type="button" class="btn btn-primary btn-dialog" data-r="0">Done</button></div>`;
      body.querySelector('[data-r="0"]').addEventListener('click', () => { dlg.close(); nav.refresh(); });
      body.querySelector('[data-r="0"]').focus();
    });
  }
  step1();
}

function restoreFlow(input, nav) {
  const d = el(`<div class="wide" aria-labelledby="dr"><h2 id="dr">Restore from a backup file</h2>
    <p>Pick a backup file you saved before. Its album will be added here. Albums already on this iPad are not changed.</p>
    <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
    <button type="button" class="btn btn-primary btn-dialog" data-r="1">Choose file</button></div></div>`);
  const dlg = openDialog(d);
  d.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
  d.querySelector('[data-r="1"]').addEventListener('click', () => { input.value = ''; input.click(); });
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    dlg.close();
    try {
      const r = await restoreBackup(file);
      await requestPersist();
      await confirmDialog({
        title: 'Backup restored',
        text: r.added
          ? `${plural(r.added, 'photo was', 'photos were')} added to ${r.names.map((n) => `“${n}”`).join(', ')}.${r.skipped ? ` ${plural(r.skipped, 'photo was', 'photos were')} already here.` : ''}`
          : 'Everything in that backup is already on this iPad. Nothing needed adding.',
        cancel: null, action: 'OK',
      });
      nav.refresh();
    } catch (e) {
      if (e && e.name === 'BadBackupError') {
        const again = await confirmDialog({
          title: 'That file couldn’t be opened', icon: 'file-error', alert: true,
          text: 'It doesn’t look like a Photo Pairs backup, or it may be damaged. Nothing on this iPad was changed.',
          cancel: 'Close', action: 'Choose another file',
        });
        if (again) { input.value = ''; input.click(); }
      } else {
        await fullDialogIfQuota(e) || confirmDialog({ title: 'The backup couldn’t be finished', text: 'Some photos may have been added. Try again; nothing is ever added twice.', cancel: null, action: 'OK' });
        nav.refresh();
      }
    }
  };
}

function isQuotaError(e) {
  return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || ''));
}
async function fullDialogIfQuota(e, saved, total) {
  if (!isQuotaError(e)) return false;
  await fullDialog(saved, total);
  return true;
}
function fullDialog(saved, total) {
  const text = total != null
    ? `We saved ${saved} of ${total} photos. To add more, free up space in the iPad’s Settings, or remove photos you don’t need here.`
    : 'To add more, free up space in the iPad’s Settings, or remove photos you don’t need here.';
  return confirmDialog({ title: 'The iPad is full', text, cancel: null, action: 'OK', alert: true, icon: 'storage-full' });
}

// ---------------------------------------------------------------- album detail
export async function renderHelperAlbum(root, nav, albumId) {
  const album = await db.getAlbum(albumId);
  if (!album) { location.hash = '#/helper/albums'; return; }
  const photos = await db.listPhotos(albumId, true);
  const urls = new Map(photos.map((p) => [p.id, objectUrl(p.thumb)]));
  const coverId = album.coverPhotoId || photos[0]?.id;

  const countLine = () => `${plural(photos.length, 'photo', 'photos')} · tap a photo to add a caption`;
  const view = el(`<main class="screen helper-album">
    <header class="helper-head">
      <a class="btn btn-quiet btn-head" href="#/helper/albums">${icon('back', 26)}<span>Albums</span></a>
      <div><h1>${esc(album.name)}</h1><p class="sub" data-count>${countLine()}</p></div>
      <button type="button" class="btn btn-primary btn-head" data-act="add" style="font-weight:700">${icon('add', 22)}<span>Add photos</span></button>
    </header>
    <input type="file" accept="image/*" multiple hidden data-file>
    <div data-progress></div>
    ${photos.length ? `<div class="photo-grid">${photos.map((p) => tileHtml(p, urls.get(p.id), p.id === coverId)).join('')}</div>` : `<div class="empty">
      ${placeholderArt(180, 150, { dashed: true, plus: true, heart: false })}
      <h2>No photos in this album yet</h2>
      <p>Pick photos from this iPad’s photo library. 6 or more works best, so there are enough for a game.</p>
      <button type="button" class="btn btn-primary btn-main" data-act="add" style="min-height:68px;padding:0 36px;font-size:calc(var(--fs-button))">Add photos</button></div>`}
  </main>`);
  const input = view.querySelector('[data-file]');
  view.querySelectorAll('[data-act="add"]').forEach((b) => b.addEventListener('click', () => { input.value = ''; input.click(); }));
  input.addEventListener('change', () => {
    const files = [...(input.files || [])];
    if (files.length) addPhotos(files);
  });
  view.querySelectorAll('.ptile[data-id]').forEach((t) => t.addEventListener('click', () => editPhoto(t.dataset.id)));

  let busy = false;
  async function addPhotos(files) {
    if (busy) return;
    busy = true;
    const total = files.length;
    const progress = view.querySelector('[data-progress]');
    let grid = view.querySelector('.photo-grid');
    if (!grid) {
      view.querySelector('.empty')?.remove();
      grid = el('<div class="photo-grid"></div>');
      view.appendChild(grid);
    }
    const pendings = files.map(() => {
      const t = el(`<div class="ptile pending" aria-hidden="true"><svg class="spin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3a9 9 0 1 1-9 9"/></svg></div>`);
      grid.appendChild(t);
      return t;
    });
    progress.innerHTML = `<div class="adding" role="status">
      <svg class="spin" aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3a9 9 0 1 1-9 9"/></svg>
      <div style="flex:1"><div class="t">Adding <span data-n>1</span> of ${total} photos…</div>
      <div class="muted">Making them smaller so they load quickly. Please keep this screen open.</div>
      <div class="bar" aria-hidden="true"><div style="width:0%"></div></div></div></div>`;
    const nEl = progress.querySelector('[data-n]');
    const fill = progress.querySelector('.bar > div');
    let saved = 0;
    let unreadable = 0;
    let full = false;
    let order = photos.length ? Math.max(...photos.map((p) => p.order || 0)) + 1 : 0;
    for (let i = 0; i < files.length; i++) {
      nEl.textContent = String(i + 1);
      const est = await storageEstimate();
      if (est && est.quota && est.quota - est.usage < 3e6) { full = true; break; }
      let processed;
      try {
        processed = await processImage(files[i]);
      } catch {
        unreadable++;
        pendings[i].remove();
        fill.style.width = Math.round((100 * (i + 1)) / total) + '%';
        continue;
      }
      const photo = { id: db.newId(), albumId, caption: '', display: processed.display, thumb: processed.thumb, order: order++, added: Date.now() };
      try {
        await db.putPhoto(photo);
      } catch (e) {
        if (isQuotaError(e)) { full = true; break; }
        unreadable++;
        pendings[i].remove();
        continue;
      }
      saved++;
      photos.push({ ...photo });
      urls.set(photo.id, objectUrl(photo.thumb));
      const tile = el(tileHtml(photo, urls.get(photo.id), photo.id === (album.coverPhotoId || photos[0].id)));
      tile.addEventListener('click', () => editPhoto(photo.id));
      pendings[i].replaceWith(tile);
      fill.style.width = Math.round((100 * (i + 1)) / total) + '%';
      view.querySelector('[data-count]').textContent = countLine();
    }
    pendings.forEach((p) => p.isConnected && p.remove());
    progress.innerHTML = '';
    busy = false;
    announce(`${plural(saved, 'photo', 'photos')} added`);
    if (saved) await requestPersist();
    if (full) await fullDialog(saved, total);
    else if (unreadable) {
      await confirmDialog({
        title: unreadable === 1 ? 'One photo couldn’t be added' : `${unreadable} photos couldn’t be added`,
        text: `${unreadable === 1 ? 'That file' : 'Those files'} couldn’t be opened, so ${unreadable === 1 ? 'it was' : 'they were'} skipped. ${saved ? `The other ${plural(saved, 'photo was', 'photos were')} added.` : ''}`.trim(),
        cancel: null, action: 'OK', icon: 'photo-error',
      });
    }
    if (!photos.length) nav.refresh();
  }

  async function editPhoto(id) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    const fresh = await db.getPhoto(id);
    const url = fresh ? objectUrl(fresh.display) : urls.get(id);
    const current = await db.getAlbum(albumId);
    const isCover = (current.coverPhotoId || photos[0]?.id) === id;
    const d = el(`<div class="photo" aria-labelledby="ce">
      <div class="preview"><img src="${url}" alt=""></div>
      <div class="fields">
        <h2 id="ce">Photo details</h2>
        <label for="cap">Caption</label>
        <input id="cap" class="text-input" type="text" maxlength="60" autocomplete="off" placeholder="Where and when? e.g. Mooloolaba, 2019" value="${esc(p.caption || '')}">
        <p class="help">Short is best. It’s shown large under the photo when a pair is found.</p>
        <div class="pair">
          <button type="button" class="btn btn-quiet" data-act="cover" ${isCover ? 'disabled' : ''}>${isCover ? 'This is the cover' : 'Use as album cover'}</button>
          <button type="button" class="btn btn-danger-quiet" data-act="remove">Remove photo</button>
        </div>
        <div data-confirm></div>
        <div class="grow"></div>
        <div class="end"><button type="button" class="btn btn-quiet" data-act="cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-act="save">Save</button></div>
      </div></div>`);
    const dlg = openDialog(d);
    const capInput = d.querySelector('#cap');
    d.querySelector('[data-act="cancel"]').addEventListener('click', () => dlg.close());
    d.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const caption = capInput.value.trim().slice(0, 60);
      await db.updatePhoto(id, { caption });
      dlg.close();
      nav.refresh();
    });
    d.querySelector('[data-act="cover"]').addEventListener('click', async (e) => {
      const a = await db.getAlbum(albumId);
      await db.putAlbum({ ...a, coverPhotoId: id });
      e.currentTarget.textContent = 'This is the cover';
      e.currentTarget.disabled = true;
      announce('Album cover changed');
    });
    d.querySelector('[data-act="remove"]').addEventListener('click', () => {
      const box = d.querySelector('[data-confirm]');
      box.innerHTML = `<div class="confirm-inline" role="alert"><span>Remove this photo from the album? It’s deleted from this app only, not from the iPad’s photo library.</span>
        <div class="row2"><button type="button" class="btn btn-quiet" data-r="0">Keep it</button><button type="button" class="btn btn-danger" data-r="1">Remove</button></div></div>`;
      box.querySelector('[data-r="0"]').addEventListener('click', () => { box.innerHTML = ''; });
      box.querySelector('[data-r="1"]').addEventListener('click', async () => {
        await db.deletePhoto(id);
        dlg.close();
        nav.refresh();
      });
      box.querySelector('[data-r="0"]').focus();
    });
  }

  root.replaceChildren(view);
}

function tileHtml(p, url, isCover) {
  const cap = p.caption || '';
  return `<button type="button" class="ptile" data-id="${esc(p.id)}" aria-label="${esc(cap || 'Photo with no caption')}. Tap to edit.">
    <span class="pimg"><img src="${url}" alt="">${isCover ? '<span class="cover-chip">Cover</span>' : ''}</span>
    <span class="cap${cap ? '' : ' none'}">${esc(cap || 'Add a caption')}</span></button>`;
}
