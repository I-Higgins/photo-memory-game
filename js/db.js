// Small IndexedDB wrapper. Photos never go anywhere else.
//  albums: { id, name, coverPhotoId, created, updated }
//  photos: { id, albumId, caption, display: Blob, thumb: Blob, order, added }

const DB_NAME = 'photo-pairs';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('albums')) db.createObjectStore('albums', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) {
        const s = db.createObjectStore('photos', { keyPath: 'id' });
        s.createIndex('albumId', 'albumId');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked'));
  });
  dbPromise.catch(() => { dbPromise = undefined; });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException('Aborted', 'AbortError'));
  });
}

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function listAlbums() {
  const db = await open();
  const tx = db.transaction(['albums', 'photos'], 'readonly');
  const albums = await req(tx.objectStore('albums').getAll());
  const idx = tx.objectStore('photos').index('albumId');
  const counts = await Promise.all(albums.map((a) => req(idx.count(a.id))));
  albums.forEach((a, i) => { a.count = counts[i]; });
  albums.sort((a, b) => a.created - b.created);
  return albums;
}

export async function getAlbum(id) {
  const db = await open();
  return req(db.transaction('albums').objectStore('albums').get(id));
}

export async function putAlbum(album) {
  const db = await open();
  const tx = db.transaction('albums', 'readwrite');
  const { count, ...clean } = album; // eslint-disable-line no-unused-vars
  tx.objectStore('albums').put({ ...clean, updated: Date.now() });
  await done(tx);
}

export async function createAlbum(name) {
  const now = Date.now();
  const album = { id: newId(), name, coverPhotoId: null, created: now, updated: now };
  await putAlbum(album);
  return album;
}

export async function deleteAlbum(id) {
  const db = await open();
  const tx = db.transaction(['albums', 'photos'], 'readwrite');
  tx.objectStore('albums').delete(id);
  const keys = await req(tx.objectStore('photos').index('albumId').getAllKeys(id));
  keys.forEach((k) => tx.objectStore('photos').delete(k));
  await done(tx);
}

/** Photos of an album, in order. Set withBlobs=false for metadata only. */
export async function listPhotos(albumId, withBlobs = true) {
  const db = await open();
  const all = await req(db.transaction('photos').objectStore('photos').index('albumId').getAll(albumId));
  all.sort((a, b) => a.order - b.order || a.added - b.added);
  if (!withBlobs) return all.map(({ display, thumb, ...rest }) => rest); // eslint-disable-line no-unused-vars
  return all;
}

export async function getPhoto(id) {
  const db = await open();
  return req(db.transaction('photos').objectStore('photos').get(id));
}

export async function getPhotos(ids) {
  const db = await open();
  const store = db.transaction('photos').objectStore('photos');
  return Promise.all(ids.map((id) => req(store.get(id))));
}

export async function putPhoto(photo) {
  const db = await open();
  const tx = db.transaction('photos', 'readwrite');
  tx.objectStore('photos').put(photo);
  await done(tx);
}

export async function updatePhoto(id, changes) {
  const db = await open();
  const tx = db.transaction('photos', 'readwrite');
  const store = tx.objectStore('photos');
  const p = await req(store.get(id));
  if (p) store.put({ ...p, ...changes });
  await done(tx);
}

export async function deletePhoto(id) {
  const db = await open();
  const tx = db.transaction(['photos', 'albums'], 'readwrite');
  const p = await req(tx.objectStore('photos').get(id));
  tx.objectStore('photos').delete(id);
  if (p) {
    const a = await req(tx.objectStore('albums').get(p.albumId));
    if (a && a.coverPhotoId === id) tx.objectStore('albums').put({ ...a, coverPhotoId: null, updated: Date.now() });
  }
  await done(tx);
}

export async function countPhotos() {
  const db = await open();
  return req(db.transaction('photos').objectStore('photos').count());
}

export async function photoIdsIn(albumId) {
  const db = await open();
  return req(db.transaction('photos').objectStore('photos').index('albumId').getAllKeys(albumId));
}
