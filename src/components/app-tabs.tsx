import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

// Five tabs, and that number is not arbitrary.
//
// An iPhone's tab bar holds five. Give it a sixth and iOS does not shrink them: it replaces the
// fifth with "More" and files the rest in a list behind it. Knitwit had six, so on every iPhone
// Calculator and Account were not tabs at all — they were two rows on a screen Knitwit never
// designed, reached through a button it never labelled.
//
// Account is the one that moved. It is settings: somewhere a knitter goes to change a unit or sign
// out, not somewhere they knit. It is a pushed screen now, opened from the avatar at the top of
// Home. See src/app/account.tsx.
//
// The order is the loop the app is for. Home says what is on the needles; Counter is where the
// knitting happens, so it takes the middle of the bar, under the thumb; Projects and Library are
// the two collections either side of it; Calculator is the tool you reach for now and then.
// web-nav.tsx keeps the same five in the same order for the web.
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Colors.cream}
      indicatorColor={Colors.creamDeep}
      labelStyle={{ selected: { color: Colors.ink } }}
      iconColor={{ default: Colors.inkSoft, selected: Colors.ink }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="projects">
        <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'folder', selected: 'folder.fill' }} md="folder" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="counter">
        <NativeTabs.Trigger.Label>Counter</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'number.circle', selected: 'number.circle.fill' }}
          md="exposure_plus_1"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calculator">
        <NativeTabs.Trigger.Label>Calculator</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ruler', selected: 'ruler.fill' }}
          md="calculate"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
