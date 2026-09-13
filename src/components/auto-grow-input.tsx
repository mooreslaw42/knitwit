import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { InputStyle } from '@/components/knitwit-ui';
import { Colors } from '@/constants/theme';

export type AutoGrowInputProps = TextInputProps & {
  minHeight?: number;
  maxHeight?: number;
};

// A multiline field that grows with what's typed into it.
//
// Every long-text box in the app was a fixed height with a scrollbar inside, which is the wrong
// shape for what's being written: a section's worth of rows in a four-line window means scrolling
// a box inside a scrolling page to check what you wrote two rows ago.
//
// Capped rather than unbounded — a pasted twelve-page pattern would otherwise put the Save button
// somewhere off in the middle distance. Past the cap it scrolls, as it always did.
//
// Native measures through onContentSizeChange, which reports the true content height and so
// shrinks as well as grows. The web build can't use that (see auto-grow-input.web.tsx).
export function AutoGrowInput({
  minHeight = 88,
  maxHeight = 480,
  style,
  onContentSizeChange,
  ...props
}: AutoGrowInputProps) {
  const [height, setHeight] = useState(minHeight);

  return (
    <TextInput
      multiline
      placeholderTextColor={Colors.inkSoft}
      onContentSizeChange={(event) => {
        const next = Math.min(maxHeight, Math.max(minHeight, event.nativeEvent.contentSize.height));
        // Only on a real change, so a report that matches what's already set doesn't re-render.
        setHeight((current) => (Math.abs(current - next) > 1 ? next : current));
        onContentSizeChange?.(event);
      }}
      style={[styles.input, { height }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: { ...InputStyle, textAlignVertical: 'top' },
});
