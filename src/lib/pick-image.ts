import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// Photos are stored inline on the model as data URLs (Pattern.photo etc.), because the whole store
// is persisted as one JSON blob — a file:// or blob: URI would not survive a reload. That makes
// size matter: the persisted store shares a ~5MB budget, so an oversized pick is refused rather
// than silently blowing the quota and failing every later write.
const MAX_DATA_URL_CHARS = 1_500_000; // ~1.5MB

// Every picked image is scaled down to this before it becomes a data URL.
//
// Without it a phone camera hands back a twelve-megapixel JPEG, which is several megabytes of
// base64 — over the ceiling above, so the picker refused every photo taken with the camera and
// said only that it was too large. Asking for a smaller one was not advice anybody could act on.
//
// 1200px is chosen for the hardest job these photos have: reading the small print on a yarn ball
// band. A thumbnail would be a tenth of the size and unreadable. Quality 0.6 on top lands a
// typical photo around 200KB of base64 — a twentieth of what a raw camera frame costs.
const MAX_WIDTH = 1200;
const QUALITY = 0.6;

export type PickImageResult =
  | { status: 'picked'; dataUrl: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'too-large' }
  | { status: 'failed' };

export async function pickImage(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] }));
}

// The camera, for photographing something in front of you rather than finding it in a roll —
// a ball band, most of all. On web there is no camera to ask for, and expo-image-picker falls
// back to the file chooser, which is the right behaviour there rather than an error.
export async function takePhoto(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] }));
}

async function toResult(result: ImagePicker.ImagePickerResult): Promise<PickImageResult> {
  if (result.canceled) return { status: 'cancelled' };

  const asset = result.assets[0];
  if (!asset?.uri) return { status: 'cancelled' };

  // base64 is asked of the manipulator, not the picker: encoding the original first would build
  // the multi-megabyte string this exists to avoid, only to throw it away.
  //
  // Reported rather than thrown. Every caller reads the status and none of them wraps the call in
  // a try — an unhandled rejection from an unreadable file would take the screen down instead of
  // saying the picture could not be used.
  let dataUrl: string | null;
  try {
    dataUrl = await downscaleToDataUrl(asset.uri);
  } catch {
    return { status: 'failed' };
  }
  if (!dataUrl) return { status: 'failed' };
  if (dataUrl.length > MAX_DATA_URL_CHARS) return { status: 'too-large' };
  return { status: 'picked', dataUrl };
}

// Scaled to fit MAX_WIDTH, re-encoded as JPEG, returned as a data URL.
//
// Only width is given, so the height follows the aspect ratio. Images already narrower than the
// ceiling are still re-encoded — a small PNG screenshot of a band can outweigh a large JPEG, and
// the compression is what makes the size predictable rather than the dimensions.
async function downscaleToDataUrl(uri: string): Promise<string | null> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH }).renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALITY,
    base64: true,
  });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
}

export function pickImageMessage(status: Exclude<PickImageResult['status'], 'picked'>): string | null {
  if (status === 'denied') return 'Knitwit needs permission to your camera or photos to add a picture.';
  if (status === 'too-large') return 'That image is too large — try a smaller one.';
  if (status === 'failed') return "That picture couldn't be read. Try another one.";
  return null; // cancelled: the user changed their mind, say nothing
}
