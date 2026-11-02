import { icon } from '../icons.js';
import { el, esc, switchHtml, bindSwitch, segHtml, bindSeg, openDialog } from '../ui.js';
import { getSettings, setSettings, effectiveTheme } from '../settings.js';
import { APP_VERSION } from '../version.js';

/** fromHelper: opened inside the helper area, so the lock section works. */
export function renderSettings(root, { fromHelper }) {
  const s = getSettings();
  const theme = effectiveTheme();
  const view = el(`<main class="screen settings">
    <header class="topbar">
      <a class="btn btn-quiet btn-player" href="${fromHelper ? '#/helper/albums' : '#/'}" style="min-width:160px;font-size:var(--fs-body)">${icon('back', 26)}<span>Done</span></a>
      <h1 style="font-size:calc(var(--fs-heading) - 2px);text-align:center;padding-top:8px">Settings</h1>
      <span></span>
    </header>
    <div class="settings-cols">
      <div>
        <section class="spanel" aria-labelledby="h-look">
          <h2 id="h-look">How it looks</h2>
          ${segHtml('size', 'Text size', [['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']], s.textSize)}
          ${segHtml('theme', 'Colours', [['light', 'Light'], ['dark', 'Dark'], ['contrast', 'High contrast']], theme)}
          <p class="small" data-theme-note>${s.theme ? '' : 'Following the iPad’s light or dark setting until you choose.'}</p>
          <div class="preview" aria-hidden="true">
            <span class="pc"><svg width="44" height="37" viewBox="0 0 104 88" fill="none" stroke="currentColor" stroke-width="4"><rect x="8" y="14" width="54" height="62" rx="6" transform="rotate(-9 35 45)" opacity=".55"/><rect x="40" y="10" width="54" height="62" rx="6" transform="rotate(8 67 41)"/></svg></span>
            <span class="pt">Mooloolaba, summer 2019<br><span>Preview of text and cards</span></span>
          </div>
        </section>
        <section class="spanel" aria-labelledby="h-about" style="gap:8px">
          <h2 id="h-about">About</h2>
          <p class="about">Photo Pairs is free and open source. Your photos never leave this iPad: there’s no account, no upload and no tracking.</p>
          <p class="small">Version ${esc(APP_VERSION)} · Works offline</p>
        </section>
      </div>
      <div>
        <section class="spanel" aria-labelledby="h-play">
          <h2 id="h-play">Playing</h2>
          ${toggle('peek', 'Look at the cards first', 'Photos show for a few seconds at the start', s.peek)}
          ${segHtml('delay', 'Cards that don’t match stay up for', [['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']], s.mismatch)}
          ${toggle('read', 'Read captions aloud', 'Shows a “Read aloud” button', s.readAloud)}
          ${toggle('sound', 'Sounds', 'A soft chime when a pair is found', s.sound)}
        </section>
        <section class="spanel" aria-labelledby="h-help" style="gap:14px">
          <h2 id="h-help">Family helper lock</h2>
          ${fromHelper ? `${toggle('code', 'Ask for a 4-digit code', s.code ? 'Code is set' : 'Off: press and hold for 2 seconds instead', !!s.code)}
            <button type="button" class="btn btn-quiet" data-act="change-code" ${s.code ? '' : 'disabled'} style="min-height:56px;border-radius:14px;font-size:calc(var(--fs-body) - 1px);font-weight:600">Change code</button>
            <p class="small">The lock only stops accidental changes. It isn’t a security lock.</p>`
            : `<div class="lock-note">${icon('lock', 28)}<p>Open <a href="#/helper" style="font-weight:600">Family helper</a> to change how it’s unlocked.</p></div>`}
        </section>
      </div>
    </div>
  </main>`);

  bindSeg(view, 'size', (v) => setSettings({ textSize: v }));
  bindSeg(view, 'theme', (v) => { setSettings({ theme: v }); view.querySelector('[data-theme-note]').textContent = ''; });
  bindSeg(view, 'delay', (v) => setSettings({ mismatch: v }));
  bindSwitch(view, 'sw-peek', (on) => setSettings({ peek: on }));
  bindSwitch(view, 'sw-read', (on) => setSettings({ readAloud: on }));
  bindSwitch(view, 'sw-sound', (on) => setSettings({ sound: on }));
  if (fromHelper) {
    const sw = bindSwitch(view, 'sw-code', (on) => {
      if (on) {
        codeDialog((code) => {
          if (code) { setSettings({ code }); refreshCode(); }
          else { sw.setAttribute('aria-checked', 'false'); sw.previousElementSibling.textContent = 'Off'; }
        });
      } else { setSettings({ code: null }); refreshCode(); }
    });
    view.querySelector('[data-act="change-code"]').addEventListener('click', () => codeDialog((code) => { if (code) setSettings({ code }); }));
    const refreshCode = () => {
      const c = getSettings().code;
      view.querySelector('#sw-code-help').textContent = c ? 'Code is set' : 'Off: press and hold for 2 seconds instead';
      view.querySelector('[data-act="change-code"]').disabled = !c;
    };
  }
  root.replaceChildren(view);
}

function toggle(key, label, help, on) {
  return `<div class="toggle-row"><div><div class="row-label" id="lbl-${key}">${esc(label)}</div><div class="row-help" id="sw-${key}-help">${esc(help)}</div></div>
    ${switchHtml('sw-' + key, 'lbl-' + key, on)}</div>`;
}

function codeDialog(done) {
  const d = el(`<div aria-labelledby="cd"><h2 id="cd">Choose a 4-digit code</h2>
    <p>Anyone helping will need it to open the Family helper. Write it down somewhere safe.</p>
    <label for="code-in">New code</label>
    <input id="code-in" class="text-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" style="letter-spacing:.4em;font-size:calc(var(--fs-heading))">
    <p data-msg role="status" style="min-height:1.4em;font-size:var(--fs-small)"></p>
    <div class="row"><button type="button" class="btn btn-quiet btn-dialog" data-r="0">Cancel</button>
    <button type="button" class="btn btn-primary btn-dialog" data-r="1">Save code</button></div></div>`);
  let result = null;
  const dlg = openDialog(d, { onClose: () => done(result) });
  const input = d.querySelector('input');
  const save = () => {
    const v = input.value.trim();
    if (!/^\d{4}$/.test(v)) { d.querySelector('[data-msg]').textContent = 'Please use exactly 4 numbers.'; return; }
    result = v;
    dlg.close();
  };
  d.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
  d.querySelector('[data-r="1"]').addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}
