// Shared Playwright helpers (plain `playwright` library + node:test).
import { chromium, webkit } from 'playwright';
import { startServer } from '../../scripts/serve.mjs';

export const IPAD = { width: 1180, height: 820 };

/** Browsers to run: E2E_BROWSERS=chromium,webkit (default both; missing ones are skipped). */
export async function availableBrowsers() {
  const wanted = (process.env.E2E_BROWSERS || 'chromium,webkit').split(',').map((s) => s.trim());
  const out = [];
  for (const name of wanted) {
    const type = { chromium, webkit }[name];
    if (!type) continue;
    try {
      const b = await type.launch();
      await b.close();
      out.push({ name, type });
    } catch (e) {
      if (process.env.CI) throw e;
      console.warn(`[e2e] skipping ${name}: ${String(e.message).split('\n')[0]}`);
    }
  }
  return out;
}

export async function server(port = 0) {
  const s = await startServer(port);
  return {
    url: `http://localhost:${s.address().port}/`,
    port: s.address().port,
    // Really take the site down: stop listening and drop open keep-alive sockets.
    close: () => new Promise((ok) => { s.close(() => ok()); s.closeAllConnections(); }),
  };
}

export async function newPage(browserType, baseUrl, { viewport = IPAD, settings = {}, init } = {}) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport, hasTouch: true, acceptDownloads: true });
  const s = { howToSeen: true, peek: false, installDismissed: true, ...settings };
  await context.addInitScript((json) => {
    if (!localStorage.getItem('photo-pairs:settings')) localStorage.setItem('photo-pairs:settings', json);
  }, JSON.stringify(s));
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(baseUrl);
  await page.waitForSelector('#app[data-route]');
  return { browser, context, page, errors };
}

/** Make test JPEG/PNG images in the browser (no real photos in the repo). */
export async function makeImages(page, specs) {
  const out = await page.evaluate(async (specs) => {
    const res = [];
    for (const [i, s] of specs.entries()) {
      const c = document.createElement('canvas');
      c.width = s.w; c.height = s.h;
      const g = c.getContext('2d');
      g.fillStyle = `hsl(${(i * 67) % 360} 60% 60%)`;
      g.fillRect(0, 0, s.w, s.h);
      g.fillStyle = '#fff';
      g.font = `${Math.round(s.h / 3)}px sans-serif`;
      g.fillText(String(i + 1), s.w / 3, s.h / 1.6);
      const type = s.type || 'image/jpeg';
      const blob = await new Promise((r) => c.toBlob(r, type, 0.9));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
      res.push({ name: `photo-${i + 1}.${type === 'image/png' ? 'png' : 'jpg'}`, mimeType: type, b64: btoa(bin) });
    }
    return res;
  }, specs);
  return out.map((f) => ({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.b64, 'base64') }));
}

export async function unlockHelper(page) {
  await page.evaluate(() => { location.hash = '#/helper'; });
  const hold = page.locator('button.hold');
  await hold.waitFor();
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  await page.getByRole('link', { name: 'Open the helper area' }).click();
  await page.getByRole('heading', { name: 'Albums' }).waitFor();
}

/** Create an album with `count` generated photos through the real UI. */
export async function createAlbumWithPhotos(page, name, count, extraFiles = []) {
  await unlockHelper(page);
  await page.getByRole('button', { name: 'New album' }).click();
  await page.getByLabel('Album name').fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('heading', { name: 'No photos in this album yet' }).waitFor();
  const specs = Array.from({ length: count }, (_, i) => (i % 3 === 0 ? { w: 2400, h: 1600 } : i % 3 === 1 ? { w: 900, h: 1400 } : { w: 800, h: 800, type: 'image/png' }));
  const files = [...(await makeImages(page, specs)), ...extraFiles];
  await page.setInputFiles('input[data-file]', files);
  const logs = [];
  const onLog = (m) => logs.push(`${m.type()}: ${m.text()}`);
  page.on('console', onLog);
  try {
    await page.waitForFunction((n) => document.querySelectorAll('.ptile[data-id]').length === n && !document.querySelector('.ptile.pending'), count, { timeout: 30000 });
  } catch (e) {
    const shown = await page.locator('.ptile[data-id]').count();
    const dialog = await page.locator('.dialog').allInnerTexts();
    throw new Error(`Expected ${count} photos, saw ${shown}. Dialog: ${dialog.join(' | ')}. Console: ${logs.join(' | ')}`);
  } finally {
    page.off('console', onLog);
  }
}

export async function savedRound(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('photo-pairs:round')).round);
}

/** Match every remaining pair using the saved round to find partners. */
export async function playToEnd(page) {
  const round = await savedRound(page);
  const done = new Set();
  for (let i = 0; i < round.cards.length; i++) {
    if (done.has(i) || round.cards[i].matched) continue;
    const j = round.cards.findIndex((c, k) => k !== i && c.photoId === round.cards[i].photoId);
    done.add(i); done.add(j);
    await page.locator(`.card[data-i="${i}"]`).click();
    await page.waitForTimeout(300);
    await page.locator(`.card[data-i="${j}"]`).click();
    const keep = page.getByRole('button', { name: 'Keep playing' });
    try {
      await keep.waitFor({ timeout: 8000 });
    } catch {
      const state = await page.evaluate(() => ({
        hash: location.hash,
        up: [...document.querySelectorAll('.card.is-up')].map((c) => c.dataset.i),
        matched: [...document.querySelectorAll('.card.is-matched')].map((c) => c.dataset.i),
        overlays: [...document.querySelectorAll('.overlay, .scrim, .banner')].map((o) => o.className + ': ' + o.innerText.slice(0, 80)),
      }));
      throw new Error(`No match moment after tapping ${i} and ${j}: ${JSON.stringify(state)}`);
    }
    await keep.click();
  }
}
