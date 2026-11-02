// Tiny static server for local development and the Playwright tests.
// Serves the app files only (design/, tests/ and node_modules are not served).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.env.ROOT || '.');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};
const BLOCKED = /^\/(design|tests|scripts|node_modules|\.git|\.github)(\/|$)/;

export function startServer(port = Number(process.env.PORT || 8080), base = '/') {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
    path = '/' + path.slice(base.length);
    if (path.endsWith('/')) path += 'index.html';
    const clean = normalize(path);
    if (BLOCKED.test(clean) || clean.includes('..')) { res.writeHead(404).end('Not found'); return; }
    const file = join(ROOT, clean);
    try {
      const s = await stat(file);
      if (!s.isFile()) throw new Error('not file');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.env.BASE || '/';
  const s = await startServer(undefined, base);
  console.log(`Photo Pairs on http://localhost:${s.address().port}${base}`);
}
