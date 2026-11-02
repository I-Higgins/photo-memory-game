// Back up / restore albums as one .zip:
//   photo-pairs.json            manifest (albums, captions, order, cover)
//   photos/<id>.jpg             display image
//   thumbs/<id>.jpg             card thumbnail
// Restore merges by id, so restoring twice never duplicates anything.

import { writeZip, readZip } from './zip.js';
import * as db from './db.js';

export const FORMAT = 'photo-pairs-backup';

export async function buildBackup(albumIds, onProgress) {
  const albums = [];
  const files = [];
  for (const id of albumIds) {
    const album = await db.getAlbum(id);
    if (!album) continue;
    const photos = await db.listPhotos(id, true);
    albums.push({
      id: album.id,
      name: album.name,
      coverPhotoId: album.coverPhotoId,
      created: album.created,
      photos: photos.map((p) => ({ id: p.id, caption: p.caption || '', order: p.order, added: p.added })),
    });
    for (const p of photos) {
      files.push({ name: `photos/${p.id}.jpg`, data: p.display });
      files.push({ name: `thumbs/${p.id}.jpg`, data: p.thumb });
    }
  }
  const manifest = { format: FORMAT, version: 1, exported: new Date().toISOString(), albums };
  const all = [{ name: 'photo-pairs.json', data: JSON.stringify(manifest, null, 1) }, ...files];
  const blob = await writeZip(all, onProgress);
  return { blob, albums };
}

export function backupFileName(albums) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const base = albums.length === 1 ? albums[0].name : 'All-albums';
  const safe = base.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'Album';
  return `${safe}-backup-${stamp}.zip`;
}

/** Share sheet with the file where supported (iPad), else a download. */
export async function saveFile(blob, name) {
  const file = new File([blob], name, { type: 'application/zip' });
  if (navigator.canShare && navigator.share) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}

/**
 * Restore from a backup file. Returns { albums: n, added: n, skipped: n }.
 * Throws BadBackupError before writing anything if the file isn't valid.
 */
export async function restoreBackup(file) {
  let entries;
  let manifest;
  try {
    entries = await readZip(file);
    const m = entries.get('photo-pairs.json');
    if (!m) throw new Error('No manifest');
    manifest = JSON.parse(await m.text());
    if (!manifest || manifest.format !== FORMAT || !Array.isArray(manifest.albums)) throw new Error('Wrong format');
    for (const a of manifest.albums) {
      if (typeof a.id !== 'string' || !Array.isArray(a.photos)) throw new Error('Wrong format');
      for (const p of a.photos) {
        if (typeof p.id !== 'string' || !entries.has(`photos/${p.id}.jpg`)) throw new Error('Missing photo');
      }
    }
  } catch (e) {
    const err = new Error('Bad backup');
    err.name = 'BadBackupError';
    err.cause = e;
    throw err;
  }

  let added = 0;
  let skipped = 0;
  for (const a of manifest.albums) {
    const existing = await db.getAlbum(a.id);
    const now = Date.now();
    if (!existing) {
      await db.putAlbum({ id: a.id, name: a.name || 'Album', coverPhotoId: a.coverPhotoId || null, created: a.created || now });
    }
    const have = new Set(await db.photoIdsIn(a.id));
    for (const p of a.photos) {
      if (have.has(p.id)) { skipped++; continue; }
      const display = new Blob([await entries.get(`photos/${p.id}.jpg`).arrayBuffer()], { type: 'image/jpeg' });
      const t = entries.get(`thumbs/${p.id}.jpg`);
      const thumb = t ? new Blob([await t.arrayBuffer()], { type: 'image/jpeg' }) : display;
      await db.putPhoto({ id: p.id, albumId: a.id, caption: (p.caption || '').slice(0, 60), display, thumb, order: p.order ?? now, added: p.added || now });
      added++;
    }
    if (existing && !existing.coverPhotoId && a.coverPhotoId) {
      await db.putAlbum({ ...existing, coverPhotoId: a.coverPhotoId });
    }
  }
  return { albums: manifest.albums.length, added, skipped, names: manifest.albums.map((a) => a.name) };
}
