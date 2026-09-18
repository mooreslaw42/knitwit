import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { InputStyle } from '@/components/knitwit-ui';
import { Colors } from '@/constants/theme';

export type AutoGrowInputProps = TextInputProps & {
  minHeight?: number;
  maxHeight?: number;
};

// A multiline field that grows with what's typed into it, and never scrolls on its own.
//
// Every long-text box in the app was a fixed height with a scrollbar inside, which is the wrong
// shape for what's being written: a section's worth of rows in a four-line window means scrolling
// a box inside a scrolling page to check what you wrote two rows ago.
//
// ## Why there is no longer a cap
//
// There was one, at 480px, on the reasoning that a pasted twelve-page pattern would otherwise put
// the Save button somewhere off in the middle distance. That traded a rare annoyance for a
// constant one: past the cap the field scrolled again, so the page had two scrollers and a knitter
// editing a long section had to get the pointer inside the right one. Which of them moves is not
// something anybody should have to aim for.
//
// So the field grows to whatever it holds and the page is the only thing that scrolls. Internal
// scrolling is switched off rather than merely unreachable — a field that cannot scroll cannot
// steal a gesture from the page even for a frame.
//
// Native measures through onContentSizeChange, which reports the true content height and so
// shrinks as well as grows. The web build can't use that (see auto-grow-input.web.tsx).
export function AutoGrowInput({
  minHeight = 88,
  // Uncapped by default. A caller that genuinely wants a ceiling can still ask for one.
  maxHeight = Infinity,
  style,
  onContentSizeChange,
  ...props
}: AutoGrowInputProps) {
  const [height, setHeight] = useState(minHeight);

  return (
    <TextInput
      multiline
      // The page is the only scroller. See the note above.
      scrollEnabled={false}
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
