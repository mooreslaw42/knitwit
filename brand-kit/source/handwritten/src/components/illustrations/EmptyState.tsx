import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { enterSoft } from '@/components/motion/presets';
import { Spacing } from '@/constants/theme';

import { Illustration, type IllustrationName } from './Illustration';

type Props = {
  illustration: IllustrationName;
  title: string;
  message?: string;
  /** Usually a <PillButton> that gets the user out of the empty state. */
  action?: ReactNode;
  compact?: boolean;
};

/** "Nothing here yet" block: craft illustration + title + hint + optional action. */
export function EmptyState({ illustration, title, message, action, compact }: Props) {
  return (
    <Animated.View entering={enterSoft} style={[styles.wrap, compact && styles.compact]}>
      <Illustration name={illustration} width={compact ? 140 : 200} />
      <ThemedText type="subtitle" style={styles.center}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="inkSoft" style={[styles.center, styles.message]}>
          {message}
        </ThemedText>
      ) : null}
      {action}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
  compact: { paddingVertical: Spacing.three },
  center: { textAlign: 'center' },
  message: { maxWidth: 280, marginBottom: Spacing.two },
});
