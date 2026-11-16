import { Platform, useWindowDimensions } from 'react-native';

import { CompactNavBelow, PhoneNavBelow } from '@/constants/theme';
import type { NavLayout } from '@/components/web-nav';

// Which navigation bar this window gets on the web. Shared so the tab screens and the pushed
// screens always agree — navigating between them must not move the menu.
export function useNavLayout(): NavLayout {
  const { width } = useWindowDimensions();
  if (width < PhoneNavBelow) return 'bottom';
  return width < CompactNavBelow ? 'compact' : 'full';
}

// Whether Account is already on screen in the navigation bar — true only on a wide web window,
// where it sits at the end of the bar across the top. On a phone, and on a phone-sized window,
// the bar has no room for it and Home shows the avatar instead. Home asks this so the same
// destination is never offered twice a thumb's width apart.
export function useAccountInNav(): boolean {
  const layout = useNavLayout();
  return Platform.OS === 'web' && layout !== 'bottom';
}
