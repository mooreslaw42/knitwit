// Native: there is no canvas to read pixels off, so the image is resized small with
// expo-image-manipulator and the resulting JPEG decoded in pure JS. jpeg-js with `useTArray`
// returns a Uint8Array and never touches Buffer, which Hermes does not provide. The resize doubles
// as the photo we keep — the base64 it already produced is the data URL, at no extra cost.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import type { LoadedImage } from '@/lib/pixel-pattern';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function loadImageData(uri: string, maxWidth: number): Promise<LoadedImage> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: maxWidth }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
  if (!saved.base64) throw new Error('Could not read the image.');
  const { width, height, data } = decodeJpeg(base64ToBytes(saved.base64), {
    useTArray: true,
    formatAsRGBA: true,
  });
  return {
    sample: { width, height, data },
    photoDataUrl: `data:image/jpeg;base64,${saved.base64}`,
  };
}
