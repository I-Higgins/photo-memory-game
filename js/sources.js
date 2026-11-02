// A "source" is something you can play: a family album or a starter pack.
import * as db from './db.js';
import { getPack } from './starter-packs.js';
import { objectUrl } from './ui.js';

/**
 * @returns {Promise<null | {type:'album'|'pack', id:string, key:string, name:string,
 *   photos:{id:string, caption:string}[]}>}
 */
export async function loadSource(type, id) {
  if (type === 'pack') {
    const p = getPack(id);
    if (!p) return null;
    return { type, id, key: `pack:${id}`, name: p.name, photos: p.photos.map(({ id: pid, caption }) => ({ id: pid, caption })) };
  }
  if (type === 'album') {
    const a = await db.getAlbum(id);
    if (!a) return null;
    const photos = await db.listPhotos(id, false);
    return { type, id, key: `album:${id}`, name: a.name, photos: photos.map((p) => ({ id: p.id, caption: p.caption || '' })) };
  }
  return null;
}

/**
 * Resolve image URLs for photo ids. Returns Map id -> { thumb, display } (URLs),
 * missing photos are left out so the card shows "This photo couldn't be shown".
 */
export async function imageUrls(source, ids) {
  const out = new Map();
  if (source.type === 'pack') {
    const p = getPack(source.id);
    for (const ph of p.photos) if (ids.includes(ph.id)) out.set(ph.id, { thumb: ph.src, display: ph.src });
    return out;
  }
  const photos = await db.getPhotos(ids).catch(() => []);
  photos.forEach((p) => {
    if (p && p.thumb && p.display) out.set(p.id, { thumb: objectUrl(p.thumb), display: objectUrl(p.display) });
  });
  return out;
}
