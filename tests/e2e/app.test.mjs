import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { availableBrowsers, server, newPage, makeImages, createAlbumWithPhotos, unlockHelper, savedRound, playToEnd } from './helpers.mjs';

const browsers = await availableBrowsers();
let srv;
before(async () => { srv = await server(); });
after(() => srv && srv.close());

const upUnmatched = (page) => page.locator('.card.is-up:not(.is-matched)').count();

for (const { name, type } of browsers) {
  describe(name, () => {
    test('add photos through the file input, see them, add a caption', async () => {
      const { browser, page, errors } = await newPage(type, srv.url);
      try {
        const bad = { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is not an image') };
        await createAlbumWithPhotos(page, 'Fishing trips', 4, [bad]);
        await page.getByRole('heading', { name: 'One photo couldn’t be added' }).waitFor();
        await page.getByRole('button', { name: 'OK' }).click();
        assert.equal(await page.locator('.ptile[data-id]').count(), 4);
        await page.locator('.ptile[data-id]').first().click();
        await page.getByLabel('Caption', { exact: true }).fill('Mooloolaba, 2019');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.locator('.ptile .cap', { hasText: 'Mooloolaba, 2019' }).waitFor();
        // processed sizes: display ≤ 1600, thumb ≤ 600
        const sizes = await page.evaluate(async () => {
          const urls = [...document.querySelectorAll('.ptile img')].map((i) => i.src);
          return Promise.all(urls.map((u) => new Promise((r) => { const im = new Image(); im.onload = () => r(Math.max(im.naturalWidth, im.naturalHeight)); im.src = u; })));
        });
        assert.ok(sizes.every((s) => s <= 600), `thumbs ${sizes}`);
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('play a full 3-pair round to completion', async () => {
      const { browser, page, errors } = await newPage(type, srv.url);
      try {
        await createAlbumWithPhotos(page, 'Grandkids', 3);
        await page.getByRole('link', { name: 'Albums' }).click();
        await page.getByRole('link', { name: 'Done, lock again' }).click();
        await page.getByRole('link', { name: /Play Grandkids/ }).click();
        assert.equal(await page.locator('.choice[data-pairs="6"]').isDisabled(), true);
        await page.locator('.choice[data-pairs="3"]').click();
        await page.locator('.card').first().waitFor();
        assert.equal(await page.locator('.card').count(), 6);
        await playToEnd(page);
        await page.getByRole('heading', { name: 'You found every pair' }).waitFor();
        assert.equal(await page.locator('.polaroid').count(), 3);
        await page.getByText('Three lovely memories from Grandkids').waitFor();
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    test('rapid tapping never shows three unmatched cards', async () => {
      const { browser, page } = await newPage(type, srv.url, { settings: { mismatch: 'short' } });
      try {
        await page.goto(srv.url + '#/play/pack/animals');
        await page.locator('.choice[data-pairs="10"]').click();
        await page.locator('.card').first().waitFor();
        const round = await savedRound(page);
        // three cards from three different pairs
        const picks = [];
        for (let i = 0; i < round.cards.length && picks.length < 3; i++) {
          if (!picks.some((k) => round.cards[k].photoId === round.cards[i].photoId)) picks.push(i);
        }
        for (const delay of [0, 40, 120, 300]) {
          for (const i of picks) {
            await page.locator(`.card[data-i="${i}"]`).tap();
            assert.ok((await upUnmatched(page)) <= 2);
            if (delay) await page.waitForTimeout(delay);
          }
          assert.ok((await upUnmatched(page)) <= 2);
          // reset: if only the first card is showing, turn a non-matching one so both flip back
          await page.waitForTimeout(300);
          const up = await page.$$eval('.card.is-up:not(.is-matched)', (els) => els.map((e) => Number(e.dataset.i)));
          if (up.length === 1) {
            const other = picks.find((k) => k !== up[0]);
            await page.locator(`.card[data-i="${other}"]`).tap();
          }
          await page.waitForFunction(() => !document.querySelector('.card.is-up:not(.is-matched)'), null, { timeout: 6000 });
        }
        // and a burst of double-taps on one card
        await page.locator('.card[data-i="0"]').dblclick();
        assert.ok((await upUnmatched(page)) <= 1);
      } finally { await browser.close(); }
    });

    test('progress and photos survive a reload', async () => {
      const { browser, page } = await newPage(type, srv.url);
      try {
        await createAlbumWithPhotos(page, 'Holidays', 6);
        await page.goto(srv.url + '#/');
        await page.getByRole('link', { name: /Play Holidays/ }).click();
        await page.locator('.choice[data-pairs="6"]').click();
        await page.locator('.card').first().waitFor();
        const round = await savedRound(page);
        const j = round.cards.findIndex((c, k) => k !== 0 && c.photoId === round.cards[0].photoId);
        await page.locator('.card[data-i="0"]').click();
        await page.waitForTimeout(300);
        await page.locator(`.card[data-i="${j}"]`).click();
        await page.getByRole('button', { name: 'Keep playing' }).click();
        await page.goto(srv.url); // reopening the app resumes the round
        await page.locator('.card').first().waitFor();
        assert.equal(await page.locator('.card.is-matched').count(), 2);
        const after = await savedRound(page);
        assert.deepEqual(after.cards.map((c) => c.photoId), round.cards.map((c) => c.photoId));
        assert.equal(await page.locator('.card .face-front img').count(), 12);
        await page.goto(srv.url + '#/');
        await page.getByText('6 photos').waitFor();
      } finally { await browser.close(); }
    });

    test('loads and plays offline after the first visit', async () => {
      const { browser, context, page } = await newPage(type, srv.url);
      try {
        await page.evaluate(async () => { await navigator.serviceWorker.ready; });
        await page.reload();
        await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
        await context.setOffline(true);
        await page.goto(srv.url + '#/');
        await page.getByRole('heading', { name: 'Pick an album to play' }).waitFor();
        await page.getByRole('link', { name: /Play Cars/ }).click();
        await page.locator('.choice[data-pairs="3"]').click();
        await page.locator('.card').first().waitFor();
        await playToEnd(page);
        await page.getByRole('heading', { name: 'You found every pair' }).waitFor();
        const loaded = await page.$$eval('.polaroid img', (imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0));
        assert.ok(loaded, 'starter pictures load from the cache');
      } finally { await context.setOffline(false).catch(() => {}); await browser.close(); }
    });

    test('back up an album, delete it, restore it', async () => {
      const { browser, page } = await newPage(type, srv.url, {
        init: () => { try { Object.defineProperty(navigator, 'share', { value: undefined }); Object.defineProperty(navigator, 'canShare', { value: undefined }); } catch { /* ignore */ } },
      });
      try {
        await createAlbumWithPhotos(page, 'Boat days', 3);
        const tiles = page.locator('.ptile[data-id]');
        const caps = ['Out on the bay', 'Dad’s first snapper', 'Sunset'];
        for (let i = 0; i < 3; i++) {
          await tiles.nth(i).click();
          await page.getByLabel('Caption', { exact: true }).fill(caps[i]);
          await page.getByRole('button', { name: 'Save', exact: true }).click();
          await page.locator('.ptile .cap', { hasText: caps[i] }).waitFor();
        }
        const before = await page.$$eval('.ptile[data-id]', (els) => els.map((e) => [e.dataset.id, e.querySelector('.cap').textContent]));
        await page.getByRole('link', { name: 'Albums' }).click();
        await page.getByRole('button', { name: 'Back up an album' }).click();
        await page.getByRole('button', { name: 'Make backup file' }).click();
        const dl = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Save backup file' }).click();
        const download = await dl;
        const path = await download.path();
        assert.match(download.suggestedFilename(), /^Boat-days-backup-\d{4}-\d{2}-\d{2}\.zip$/);
        await page.getByRole('heading', { name: 'Backup saved' }).waitFor();
        await page.getByRole('button', { name: 'Done' }).click();

        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('heading', { name: 'Delete “Boat days”?' }).waitFor();
        await page.getByText('its 3 photos').waitFor();
        await page.getByRole('button', { name: 'Delete album' }).click();
        await page.getByText('0 photos saved on this iPad').waitFor();

        // a bad file is refused without changing anything
        await page.getByRole('button', { name: 'Restore from a backup file' }).click();
        await page.locator('[data-restore-input]').setInputFiles({ name: 'nope.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip') });
        await page.getByRole('heading', { name: 'That file couldn’t be opened' }).waitFor();
        await page.getByRole('button', { name: 'Close' }).click();

        await page.getByRole('button', { name: 'Restore from a backup file' }).click();
        await page.locator('[data-restore-input]').setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: await readFile(path) });
        await page.getByRole('heading', { name: 'Backup restored' }).waitFor();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByText('3 photos saved on this iPad').waitFor();

        // restoring again doesn't duplicate
        await page.getByRole('button', { name: 'Restore from a backup file' }).click();
        await page.locator('[data-restore-input]').setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: await readFile(path) });
        await page.getByText('Everything in that backup is already on this iPad').waitFor();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByText('3 photos saved on this iPad').waitFor();

        await page.getByRole('link', { name: 'Boat days' }).click();
        await page.locator('.ptile[data-id]').first().waitFor();
        const restored = await page.$$eval('.ptile[data-id]', (els) => els.map((e) => [e.dataset.id, e.querySelector('.cap').textContent]));
        assert.deepEqual(restored, before);
      } finally { await browser.close(); }
    });

    test('helper code: wrong code refused, right code opens', async () => {
      const { browser, page } = await newPage(type, srv.url, { settings: { code: '2468' } });
      try {
        await page.evaluate(() => { location.hash = '#/helper'; });
        for (const k of '1111') await page.getByRole('button', { name: k, exact: true }).click();
        await page.getByText('That code didn’t work. Try again.').waitFor();
        await page.waitForTimeout(800);
        for (const k of '2468') await page.getByRole('button', { name: k, exact: true }).click();
        await page.getByRole('link', { name: 'Open the helper area' }).waitFor();
      } finally { await browser.close(); }
    });

    test('Settings from Home cannot change the helper lock; text size and theme apply', async () => {
      const { browser, page } = await newPage(type, srv.url);
      try {
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.getByText('to change how it’s unlocked').waitFor();
        assert.equal(await page.getByRole('switch', { name: 'Ask for a 4-digit code' }).count(), 0);
        await page.getByRole('radio', { name: 'Extra large' }).click();
        await page.getByRole('radio', { name: 'High contrast' }).click();
        assert.equal(await page.evaluate(() => document.documentElement.dataset.text), 'xl');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'contrast');
        // read aloud is off by default and absent from the match moment
        assert.equal(await page.getByRole('switch', { name: 'Read captions aloud' }).getAttribute('aria-checked'), 'false');
      } finally { await browser.close(); }
    });
  });
}
