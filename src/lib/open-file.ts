import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

// Reading a file the knitter chose, as text. Used for restoring a backup.
//
// Kept apart from read-pattern-file.ts, which does its own PDF handling and refusals for scanned
// documents. This one wants JSON and nothing else.
export async function openTextFile(): Promise<{ text: string; name: string } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;

  const asset = picked.assets[0];
  if (!asset?.uri) return null;

  // Read the picked file directly rather than with fetch(). On web the picker hands back a DOM
  // File; on native, fetching the file:// URI routed through the networking layer, where Sentry's
  // http instrumentation threw serialising the status-less request — the silent failure that hit
  // pattern import as Bugsink KNITWIT-1, and would hit a backup restore the same way.
  const file = (asset as { file?: Blob }).file;
  const text = file ? await file.text() : await new File(asset.uri).text();
  return { text, name: asset.name ?? 'backup.json' };
}
