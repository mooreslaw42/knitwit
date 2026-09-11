import * as ImagePicker from 'expo-image-picker';

// Photos are stored inline on the model as data URLs (Pattern.photo etc.), because the whole store
// is persisted as one JSON blob — a file:// or blob: URI would not survive a reload. That makes
// size matter: the persisted store shares a ~5MB budget, so an oversized pick is refused rather
// than silently blowing the quota and failing every later write.
const MAX_DATA_URL_CHARS = 1_500_000; // ~1.5MB

export type PickImageResult =
  | { status: 'picked'; dataUrl: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'too-large' };

export async function pickImage(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.5,
    base64: true,
  });
  if (result.canceled) return { status: 'cancelled' };

  const asset = result.assets[0];
  if (!asset?.base64) return { status: 'cancelled' };

  const dataUrl = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  if (dataUrl.length > MAX_DATA_URL_CHARS) return { status: 'too-large' };
  return { status: 'picked', dataUrl };
}

export function pickImageMessage(status: Exclude<PickImageResult['status'], 'picked'>): string | null {
  if (status === 'denied') return 'Knitwit needs permission to your photos to add a picture.';
  if (status === 'too-large') return 'That image is too large — try a smaller one.';
  return null; // cancelled: the user changed their mind, say nothing
}
