// Small DOM helpers: escaping, dialogs (focus moves in, scrim never closes),
// a polite live region, and object-URL bookkeeping.

import { icon } from './icons.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ---- object URLs: revoked when the screen changes ----
let screenUrls = [];
export function objectUrl(blob) {
  const u = URL.createObjectURL(blob);
  screenUrls.push(u);
  return u;
}
/** Detach the current screen's URLs; call the returned function to revoke them. */
export function takeScreenUrls() {
  const old = screenUrls;
  screenUrls = [];
  return () => old.forEach((u) => URL.revokeObjectURL(u));
}

// ---- live region ----
export function announce(text) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 50);
}

// ---- dialogs ----
const stack = [];

/**
 * Open a modal dialog. `build(close)` returns the dialog element (role dialog).
 * Returns { close, el }. Tapping the scrim does nothing (by design).
 */
export function openDialog(dialogEl, { onClose, role = 'dialog' } = {}) {
  const scrim = el('<div class="scrim"></div>');
  dialogEl.setAttribute('role', dialogEl.getAttribute('role') || role);
  dialogEl.setAttribute('aria-modal', 'true');
  dialogEl.classList.add('dialog');
  scrim.appendChild(dialogEl);
  const previous = document.activeElement;
  document.body.appendChild(scrim);
  setInert(true);
  const entry = { scrim, previous };
  stack.push(entry);
  const focusFirst = () => {
    const f = dialogEl.querySelector('[autofocus], input, button, [href], [tabindex]:not([tabindex="-1"])');
    (f || dialogEl).focus({ preventScroll: true });
  };
  if (!dialogEl.hasAttribute('tabindex')) dialogEl.setAttribute('tabindex', '-1');
  requestAnimationFrame(focusFirst);
  scrim.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dialogEl.querySelectorAll('input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scrim.remove();
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) setInert(false);
    if (previous && previous.isConnected && previous.focus) previous.focus({ preventScroll: true });
    onClose && onClose();
  };
  return { close, el: dialogEl, scrim };
}

export function closeAllDialogs() {
  while (stack.length) {
    const { scrim } = stack.pop();
    scrim.remove();
  }
  setInert(false);
}

function setInert(on) {
  const app = document.getElementById('app');
  if (!app) return;
  if (on) app.setAttribute('inert', ''); else app.removeAttribute('inert');
  app.setAttribute('aria-hidden', on ? 'true' : 'false');
  if (!on) app.removeAttribute('aria-hidden');
}

/** Simple two-button (or one-button) dialog. Resolves true for the action. */
export function confirmDialog({ title, text, cancel = 'Cancel', action = 'OK', danger = false, icon: ic, alert = false, wide = false }) {
  return new Promise((resolve) => {
    const d = el(`<div class="${wide ? 'wide' : ''}" aria-labelledby="dlg-t">
      ${ic ? `<span class="dialog-icon">${icon(ic, 44)}</span>` : ''}
      <h2 id="dlg-t">${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
      <div class="row">
        ${cancel ? `<button type="button" class="btn btn-quiet btn-dialog" data-r="0">${esc(cancel)}</button>` : ''}
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-dialog" data-r="1">${esc(action)}</button>
      </div></div>`);
    let result = false;
    const dlg = openDialog(d, { role: alert ? 'alertdialog' : 'dialog', onClose: () => resolve(result) });
    d.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { result = b.dataset.r === '1'; dlg.close(); }));
  });
}

/** Switch markup: role="switch" with the word On/Off beside it. */
export function switchHtml(id, labelId, on) {
  return `<span class="switch-wrap"><span class="switch-word" aria-hidden="true">${on ? 'On' : 'Off'}</span><button type="button" class="switch" role="switch" id="${id}" aria-checked="${on}" aria-labelledby="${labelId}"><span class="knob"></span></button></span>`;
}

export function bindSwitch(root, id, onChange) {
  const b = root.querySelector('#' + id);
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(on));
    b.previousElementSibling.textContent = on ? 'On' : 'Off';
    onChange(on, b);
  });
  return b;
}

/** Segmented control markup (role radiogroup). */
export function segHtml(name, label, options, value) {
  return `<div class="seg-group"><span class="seg-label" id="seg-${name}">${esc(label)}</span>
    <div class="seg" role="radiogroup" aria-labelledby="seg-${name}">
    ${options.map(([v, l]) => `<button type="button" role="radio" data-seg="${name}" data-v="${v}" aria-checked="${v === value}" tabindex="${v === value ? 0 : -1}">${esc(l)}</button>`).join('')}
    </div></div>`;
}

export function bindSeg(root, name, onChange) {
  const btns = [...root.querySelectorAll(`[data-seg="${name}"]`)];
  const pick = (b) => {
    btns.forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
    onChange(b.dataset.v);
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => pick(b));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = btns[(i + d + btns.length) % btns.length];
      n.focus();
      pick(n);
    });
  });
}

/** The app mark used on Home and in the install card. */
export function appMark(size) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 64 64" style="flex:none"><rect width="64" height="64" rx="15" fill="var(--card-back)"/><rect x="12" y="16" width="24" height="30" rx="4" fill="var(--on-card)" opacity=".55" transform="rotate(-9 24 31)"/><rect x="27" y="14" width="25" height="31" rx="4" fill="var(--on-card)" transform="rotate(8 39 29)"/><path d="M39.5 37c-4-2.8-6.3-5.1-6.3-7.6a3.1 3.1 0 0 1 6.3-.9 3.1 3.1 0 0 1 6.3.9c0 2.5-2.3 4.8-6.3 7.6z" fill="var(--heart)"/></svg>`;
}

/** Two stacked photos art (album placeholder / empty state). */
export function placeholderArt(w, h, { dashed = false, plus = false, heart = true, stroke = 3 } = {}) {
  return `<svg class="placeholder-art" aria-hidden="true" width="${w}" height="${h}" viewBox="0 0 120 104"><rect class="pc" x="14" y="14" width="60" height="74" rx="8" stroke-width="${stroke}" transform="rotate(-8 44 51)"/><rect class="pc" x="46" y="10" width="60" height="74" rx="8" stroke-width="${stroke}" ${dashed ? 'stroke-dasharray="6 5"' : ''} transform="rotate(7 76 47)"/>${heart ? '<path class="ht" d="M76 58c-7-5-11-8.6-11-12.8a5.5 5.5 0 0 1 11-1.4 5.5 5.5 0 0 1 11 1.4c0 4.2-4 7.8-11 12.8z"/>' : ''}${plus ? '<path class="plus" d="M76 38v20M66 48h20" stroke-width="4" stroke-linecap="round" fill="none"/>' : ''}</svg>`;
}

/** Album cover block when there's no cover photo (album-placeholder.svg). */
export function coverPlaceholder(cls = 'cover') {
  return `<img class="${cls}" src="assets/app/album-placeholder.svg" alt="">`;
}
