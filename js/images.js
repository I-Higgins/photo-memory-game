// Turn a picked file into a display JPEG (~1600 px long edge) and a card
// thumbnail (~600 px). Browsers apply EXIF orientation when drawing an <img>
// to a canvas (Safari 13.1+, Chrome 81+, Firefox 77+), so that's what we
// use. Safari decodes HEIC/HEIF itself; other browsers will reject HEIC and
// the file is skipped with the friendly message.

export const DISPLAY_EDGE = 1600;
export const THUMB_EDGE = 600;
export const JPEG_QUALITY = 0.85;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unreadable image')); };
    img.src = url;
  });
}

function scaleTo(w, h, edge) {
  const k = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/jpeg', quality);
  });
}

async function render(source, sw, sh, edge) {
  const { w, h } = scaleTo(sw, sh, edge);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#FFFFFF'; // PNGs with transparency get a white mat
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const blob = await canvasToBlob(c, JPEG_QUALITY);
  c.width = 0; // release canvas memory straight away (matters on iPad)
  c.height = 0;
  return { blob, w, h };
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{display:Blob, thumb:Blob, width:number, height:number}>}
 */
export async function processImage(file) {
  const { img, url } = await loadImage(file);
  try {
    if (img.decode) await img.decode().catch(() => {});
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (!sw || !sh) throw new Error('Unreadable image');
    const display = await render(img, sw, sh, DISPLAY_EDGE);
    // Thumbnail from the smaller display image: faster and lighter on memory.
    const { img: small, url: smallUrl } = await loadImage(display.blob);
    try {
      const thumb = await render(small, display.w, display.h, THUMB_EDGE);
      return { display: display.blob, thumb: thumb.blob, width: display.w, height: display.h };
    } finally {
      URL.revokeObjectURL(smallUrl);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
