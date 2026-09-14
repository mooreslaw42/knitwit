import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewProps } from 'react-native';

// A row or card that navigates — as a real link.
//
// These were Pressables calling router.push, which works but is not a link: no ⌘-click to open in
// a new tab, no middle-click, no right-click to copy the address, and no URL in the status bar on
// hover. On a website that is most of what people expect a list of things to do.
//
// The styling goes on an inner View, not on the Pressable. `Link asChild` clones its child and
// supplies its own props, `style` among them — passing the row's style to the Pressable looked
// right and silently lost it, so every row rendered as unstyled stacked text. The anchor is left
// as a bare wrapper and the View below it carries the card.
export function CardLink({
  href,
  style,
  hoverStyle,
  children,
  accessibilityLabel,
}: {
  href: Href;
  style?: ViewProps['style'];
  // Applied on hover. Defaults to a small lift in opacity; a caller can pass its own.
  hoverStyle?: ViewProps['style'];
  children: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={href} asChild>
      <Pressable
        // On web the anchor already announces itself as a link; saying "button" as well would be
        // a lie. On native there is no anchor, so it needs the role.
        accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
        accessibilityLabel={accessibilityLabel}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}>
        <View style={[style, hovered && (hoverStyle ?? styles.hovered)]}>{children}</View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  hovered: { opacity: 0.85 },
});
