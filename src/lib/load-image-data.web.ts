// Web: the browser decodes the image for us. Draw it onto a canvas scaled to the sampling width
// and read the pixels straight back — no decoder dependency, any format the browser supports. The
// same canvas re-encodes the photo we keep.
import type { LoadedImage } from '@/lib/pixel-pattern';

function loadHtmlImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Picked images are same-origin blob:/data: URLs, so this only matters if a remote URL ever
    // reaches here; without it getImageData would throw on a tainted canvas.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the image.'));
    img.src = uri;
  });
}

export async function loadImageData(uri: string, maxWidth: number): Promise<LoadedImage> {
  const img = await loadHtmlImage(uri);
  const scale = Math.min(1, maxWidth / (img.naturalWidth || img.width));
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read the image.');
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return {
    sample: { width, height, data },
    photoDataUrl: canvas.toDataURL('image/jpeg', 0.85),
  };
}
