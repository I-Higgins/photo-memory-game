// Render the app icon PNGs from the design's source SVGs with headless Chromium.
// Usage: node scripts/make-icons.mjs   (needs the `playwright` dev dependency)
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';

const jobs = [
  ['assets/app/app-icon-1024.svg', 'icons/icon-512.png', 512],
  ['assets/app/app-icon-1024.svg', 'icons/icon-192.png', 192],
  ['assets/app/app-icon-1024.svg', 'icons/apple-touch-icon.png', 180],
  ['assets/app/app-icon-maskable-1024.svg', 'icons/icon-maskable-512.png', 512],
];

await mkdir('icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  const svg = await readFile(src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: out, omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', out);
}
await browser.close();
