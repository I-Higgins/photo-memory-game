// The list of files that make up the app (everything the service worker must precache).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    .filter((f) => !f.endsWith('.DS_Store'));
}

export function appFiles(root = '.') {
  const rel = (f) => f.slice(root === '.' ? 0 : root.length + 1).split('\\').join('/');
  return ['index.html', 'manifest.webmanifest', ...['css', 'js', 'assets', 'icons'].flatMap((d) => walk(join(root, d)).map(rel))].sort();
}
