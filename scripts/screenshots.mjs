// Screenshot every screen/state for comparing with design/boards.
// Usage: node scripts/screenshots.mjs [outDir]   (default screenshots/out)
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';
import { unlockHelper } from '../tests/e2e/helpers.mjs';

const out = process.argv[2] || 'screenshots/out';
await mkdir(out, { recursive: true });
const srv = await startServer(0);
const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();

const DEMO = [
  ['beach', 'Mooloolaba, summer 2019'], ['boat', 'Out on the bay at sunset'], ['fish', 'Dad’s first big snapper'],
  ['dog', 'Biscuit, aged two'], ['ute', ''], ['roses', 'Mum’s roses by the back fence'], ['lighthouse', 'The lighthouse walk'],
  ['cake', ''], ['caravan', 'Camping at the national park'], ['kite', 'Flying kites on the headland'],
];

async function session({ width, height, theme = null, reduced = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((t) => {
    if (!localStorage.getItem('photo-pairs:settings')) localStorage.setItem('photo-pairs:settings', JSON.stringify({ howToSeen: true, peek: false, installDismissed: true, theme: t }));
  }, theme);
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForSelector('#app[data-route]');
  return { ctx, page };
}

async function seed(page) {
  await unlockHelper(page);
  for (const [name, n] of [['Family favourites', 10], ['Fishing trips', 4]]) {
    await page.getByRole('button', { name: 'New album' }).click();
    await page.getByLabel('Album name').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('heading', { name: 'No photos in this album yet' }).waitFor();
    const files = await Promise.all(DEMO.slice(0, n).map(async ([f]) => ({ name: `${f}.svg`, mimeType: 'image/svg+xml', buffer: await readFile(`design/assets/demo-photos/${f}.svg`) })));
    await page.setInputFiles('input[data-file]', files);
    await page.waitForFunction((k) => document.querySelectorAll('.ptile[data-id]').length === k && !document.querySelector('.ptile.pending'), n);
    if (name === 'Family favourites') {
      // captions straight into IndexedDB (faster than the dialog for 10 photos)
      await page.evaluate(async (caps) => {
        const db = await import('./js/db.js');
        const albums = await db.listAlbums();
        const photos = await db.listPhotos(albums[0].id, false);
        for (let i = 0; i < photos.length; i++) await db.updatePhoto(photos[i].id, { caption: caps[i] || '' });
      }, DEMO.map((d) => d[1]));
    }
    await page.getByRole('link', { name: 'Albums' }).click();
  }
}

const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const go = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(400); };

async function ipad(theme, w = 1180, h = 820) {
  const tag = `${w}x${h}-${theme || 'light'}`;
  const { ctx, page } = await session({ width: w, height: h, theme });
  await seed(page);
  await shot(page, `helper-albums-${tag}`);
  await page.getByRole('link', { name: 'Family favourites' }).click();
  await page.waitForTimeout(400);
  await shot(page, `helper-album-${tag}`);
  await page.locator('.ptile[data-id]').first().click();
  await page.waitForTimeout(400);
  await shot(page, `helper-photo-dialog-${tag}`);
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await shot(page, `helper-photo-remove-${tag}`);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await go(page, '#/helper/settings');
  await shot(page, `settings-helper-${tag}`);
  await go(page, '#/helper/albums');
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await shot(page, `helper-delete-${tag}`);
  await page.getByRole('button', { name: 'Keep album' }).click();
  await page.getByRole('link', { name: 'Done, lock again' }).click();
  await page.waitForTimeout(400);
  await shot(page, `home-${tag}`);
  await go(page, '#/settings');
  await shot(page, `settings-${tag}`);
  await go(page, '#/helper');
  await shot(page, `helper-unlock-${tag}`);
  await go(page, '#/');
  await page.getByRole('link', { name: /Play Fishing trips/ }).click();
  await page.waitForTimeout(300);
  await shot(page, `difficulty-disabled-${tag}`);
  await go(page, '#/');
  await page.getByRole('link', { name: /Play Family favourites/ }).click();
  await page.waitForTimeout(300);
  await shot(page, `difficulty-${tag}`);
  for (const pairs of [3, 6, 8, 10]) {
    await go(page, '#/');
    await page.getByRole('link', { name: /Play Family favourites/ }).click();
    const sw = page.getByRole('switch', { name: 'Look at all the cards first' });
    if ((await sw.getAttribute('aria-checked') === 'true') !== (pairs === 6)) await sw.click();
    await page.locator(`.choice[data-pairs="${pairs}"]`).click();
    await page.locator('.card').first().waitFor();
    await page.waitForTimeout(700);
    if (pairs === 6) { await shot(page, `game-peek-${tag}`); await page.getByRole('button', { name: 'I’m ready' }).click(); await page.waitForTimeout(900); }
    const round = await page.evaluate(() => JSON.parse(localStorage.getItem('photo-pairs:round')).round);
    const j = round.cards.findIndex((c, k) => k && c.photoId === round.cards[0].photoId);
    await page.locator('.card[data-i="0"]').click();
    await page.waitForTimeout(300);
    await page.locator(`.card[data-i="${j}"]`).click();
    await page.waitForTimeout(1100);
    if (pairs === 6) await shot(page, `match-moment-${tag}`);
    await page.getByRole('button', { name: 'Keep playing' }).click();
    const k = round.cards.findIndex((c, n) => n !== 0 && n !== j);
    await page.locator(`.card[data-i="${k}"]`).click();
    await page.waitForTimeout(500);
    await shot(page, `game-${pairs * 2}-${tag}`);
    if (pairs === 6) {
      await page.getByRole('button', { name: 'Hint' }).first().click();
      await page.waitForTimeout(650);
      await shot(page, `game-hint-${tag}`);
      await page.getByRole('button', { name: 'Restart' }).first().click();
      await page.waitForTimeout(400);
      await shot(page, `restart-confirm-${tag}`);
      await page.getByRole('button', { name: 'Keep playing' }).click();
    }
    if (pairs === 3) {
      await page.waitForTimeout(2200);
      const r = await page.evaluate(() => JSON.parse(localStorage.getItem('photo-pairs:round')).round);
      const left = [...new Set(r.cards.filter((c) => !c.matched).map((c) => c.photoId))];
      for (const pid of left) {
        const idx = r.cards.map((c, n) => (c.photoId === pid ? n : -1)).filter((n) => n >= 0);
        await page.locator(`.card[data-i="${idx[0]}"]`).click();
        await page.waitForTimeout(300);
        await page.locator(`.card[data-i="${idx[1]}"]`).click();
        await page.getByRole('button', { name: 'Keep playing' }).click();
      }
      await page.waitForTimeout(1200);
      await shot(page, `round-complete-${tag}`);
    }
  }
  await ctx.close();
}

if (!process.env.README_ONLY) {
  await ipad(null);
  await ipad('dark');
  await ipad('contrast');
  await ipad(null, 820, 1180);
  await ipad(null, 768, 1024);
  await ipad(null, 390, 844);
}

// README screenshot: starter-pack art only
{
  const { ctx, page } = await session({ width: 1180, height: 820 });
  await go(page, '#/play/pack/animals');
  await page.locator('.choice[data-pairs="6"]').click();
  await page.locator('.card').first().waitFor();
  const round = await page.evaluate(() => JSON.parse(localStorage.getItem('photo-pairs:round')).round);
  const pairs = [...new Set(round.cards.map((c) => c.photoId))].slice(0, 2);
  for (const pid of pairs) {
    const idx = round.cards.map((c, n) => (c.photoId === pid ? n : -1)).filter((n) => n >= 0);
    await page.locator(`.card[data-i="${idx[0]}"]`).click();
    await page.waitForTimeout(300);
    await page.locator(`.card[data-i="${idx[1]}"]`).click();
    await page.getByRole('button', { name: 'Keep playing' }).click();
  }
  const first = round.cards.findIndex((c) => !pairs.includes(c.photoId));
  await page.locator(`.card[data-i="${first}"]`).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/game.png' });
  await go(page, '#/');
  await page.screenshot({ path: 'screenshots/home.png' });
  await ctx.close();
}

await browser.close();
srv.close();
console.log('screenshots in', out);
