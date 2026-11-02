# Contributing

Thanks for helping. Keep it simple: plain HTML/CSS/JS, no frameworks, no build step, no runtime dependencies, and nothing that sends data off the device.

Before opening a pull request, run `npm test` and `npm run test:e2e`.

## Adding a starter pack

1. Draw 10 original pictures as SVG (no clip-art or brand marks), following the style in `design/boards/StarterPacks.dc.html`:
   - `viewBox="0 0 100 100"`, a rounded tinted square behind the subject (`rx="16"`),
   - flat shapes, no outlines, the subject inside the middle 80% (cards are centre-cropped),
   - colours from the shared palette listed on that board.
2. Put them in `assets/starter-packs/<pack-id>/<picture-id>.svg` (lowercase, hyphens).
3. Add the pack to `PACKS` in `js/starter-packs.js` (id, name, and `[file, caption]` for each picture) and pick its cover in `COVERS`.
4. Run `node scripts/update-precache.mjs` so the service worker caches the new files, and bump the version in `sw.js` and `js/version.js`.
5. `npm test` checks every listed file exists and is precached.

## Design

`design/` is the source of truth for visuals. Colours, sizes and timings come from `css/tokens.css`; please don't hard-code new colours.
