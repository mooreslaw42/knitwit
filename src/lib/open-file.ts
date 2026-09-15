import * as DocumentPicker from 'expo-document-picker';

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

  // fetch reads a file:// URI on native and a blob: URI on web, which is the one call that works
  // on both without pulling in a filesystem module.
  const text = await (await fetch(asset.uri)).text();
  return { text, name: asset.name ?? 'backup.json' };
}
