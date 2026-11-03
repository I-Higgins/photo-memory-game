import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('pinch and double-tap zoom are turned off', () => {
  const html = readFileSync('index.html', 'utf8');
  const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)[1];
  assert.match(viewport, /maximum-scale=1/);
  assert.match(viewport, /user-scalable=no/);
  assert.match(readFileSync('css/app.css', 'utf8'), /html \{[^}]*touch-action: manipulation/);
  assert.match(readFileSync('js/app.js', 'utf8'), /gesturestart/);
});
