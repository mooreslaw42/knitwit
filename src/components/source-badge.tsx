import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';

// Where a value in a form came from, marked on the field itself.
//
// A prefilled form is only trustworthy if you can tell which parts of it you wrote. Saying it once
// in prose above the form — "read from the band: brand, colour, dye lot…" — meant holding a list in
// your head while scrolling past the fields it described. The mark belongs on the field.
export type FieldSource = 'band' | 'web';

const BADGES: Record<FieldSource, { icon: string; what: string; why: string }> = {
  band: {
    icon: '📷',
    what: 'Read from your photo',
    why: 'Knitwit read this off the ball band you photographed. Worth a glance before you save.',
  },
  web: {
    icon: '🔍',
    what: 'Found on the web',
    why: 'This came from a web search for the yarn, not from your band — so it describes the yarn in general, not your particular skein.',
  },
};

export function SourceBadge({ source, detail }: { source: FieldSource; detail?: string }) {
  // Hovering and tapping are tracked apart, and the tip shows for either.
  //
  // One `open` flag driven by both did the wrong thing on a mouse: moving onto the icon opened the
  // tip, and the click that followed toggled the same flag straight back off, so clicking appeared
  // to do nothing at all.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const badge = BADGES[source];
  const explanation = detail ? `${badge.why} ${detail}` : badge.why;

  return (
    <View style={styles.anchor}>
      {/* Hover on a mouse, tap on a finger: the same explanation either way, since there is no
          hovering on a phone and the mark would otherwise be a mystery there. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${badge.what}. ${explanation}`}
        hitSlop={8}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={() => setPinned((v) => !v)}>
        <ThemedText type="small" style={styles.icon}>
          {badge.icon}
        </ThemedText>
      </Pressable>

      {/* Absolute, so showing it never reflows the form — a tooltip that pushes the field you are
          reading down the screen is worse than no tooltip.
          Upward, because downward did not work. Painting order decides what covers what here: a
          tip hanging below the label was drawn under every field that comes after it, which cut it
          off mid-sentence. Nothing was clipping it — the box was its full height the whole time,
          with the next field's white input on top. Opening upward puts it over content that was
          painted earlier, which loses to it. */}
      {open ? (
        <View style={styles.tip} pointerEvents="none">
          <ThemedText type="smallBold" themeColor="white">
            {badge.what}
          </ThemedText>
          <ThemedText type="small" themeColor="white" style={styles.tipBody}>
            {explanation}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'relative',
    // Every ancestor between here and the form clips by default on web, so each one in the chain
    // opens up — otherwise the tip is cut off at the bottom of the label it hangs from.
    overflow: 'visible',
    // Above the fields below it, or the tooltip is drawn behind the next label.
    zIndex: 10,
  },
  icon: {
    lineHeight: 16,
  },
  tip: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    width: 260,
    backgroundColor: Colors.ink,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: 2,
    zIndex: 20,
  },
  tipBody: {
    opacity: 0.85,
  },
});
