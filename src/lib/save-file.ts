import { Share } from 'react-native';

// Handing a file to the knitter. The web build has its own version of this file.
//
// Native has no download folder to drop something into, so the share sheet is the way out — it
// reaches Files, Mail, AirDrop and everything else the phone already knows how to do.
export async function saveTextFile(_name: string, text: string): Promise<boolean> {
  const result = await Share.share({ message: text });
  return result.action !== Share.dismissedAction;
}
