// Prepares a user-chosen photo for upload, entirely in the browser:
// decode → scale down to fit 1600×1600 → re-encode as JPEG (≤ 2 MB).
// Re-encoding through a canvas drops ALL metadata (EXIF), including GPS location and camera
// details, and anything that is not a real image fails to decode and is rejected.

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // must match the storage bucket limit
const MAX_SIDE = 1600;

export const IMAGE_ACCEPT = ACCEPTED.join(',');

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * @param {File} file
 * @returns {Promise<{ ok: true, blob: Blob } | { ok: false, reason: 'type'|'size'|'decode' }>}
 */
export async function prepareImage(file) {
  if (!file || !ACCEPTED.includes(file.type)) return { ok: false, reason: 'type' };
  if (file.size > MAX_INPUT_BYTES) return { ok: false, reason: 'size' };

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, reason: 'decode' };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height); // transparent PNGs get a dark background
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (typeof bitmap.close === 'function') bitmap.close();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= MAX_OUTPUT_BYTES) return { ok: true, blob };
  }
  return { ok: false, reason: 'size' };
}
