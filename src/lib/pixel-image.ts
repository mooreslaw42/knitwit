// Picking a photo for the pixel-pattern builder. Thin on purpose: the library picker is the same
// on every platform, the pixel-reading that isn't lives behind loadImageData (platform-split), and
// the not-picked messages are shared with the ordinary photo picker so the wording stays identical.
import * as ImagePicker from 'expo-image-picker';

import { loadImageData } from '@/lib/load-image-data';
import { pickImageMessage } from '@/lib/pick-image';
import type { LoadedImage } from '@/lib/pixel-pattern';

// Downscale target before quantising. Big enough that box-sampling to a 60-stitch grid still
// averages real detail; small enough that decoding and re-quantising on every slider nudge is
// instant. Also the resolution of the photo kept on the pattern.
const SAMPLE_WIDTH = 480;

export type PickPixelResult =
  | { status: 'picked'; image: LoadedImage }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'failed' };

export async function pickPixelImage(): Promise<PickPixelResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
  if (result.canceled) return { status: 'cancelled' };
  const uri = result.assets[0]?.uri;
  if (!uri) return { status: 'cancelled' };
  try {
    return { status: 'picked', image: await loadImageData(uri, SAMPLE_WIDTH) };
  } catch {
    return { status: 'failed' };
  }
}

export { pickImageMessage };
