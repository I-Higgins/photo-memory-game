// Rewrites the PRECACHE list in sw.js from the files on disk.
// Run after adding/removing app files: node scripts/update-precache.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { appFiles } from './app-files.mjs';

const sw = readFileSync('sw.js', 'utf8');
const list = ['./', ...appFiles()].map((f) => `  '${f}',`).join('\n');
const next = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n${list}\n];`);
writeFileSync('sw.js', next);
console.log(`sw.js precaches ${appFiles().length + 1} entries`);
