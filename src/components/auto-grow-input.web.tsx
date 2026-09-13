import { useCallback, useLayoutEffect, useRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import type { AutoGrowInputProps } from '@/components/auto-grow-input';
import { InputStyle } from '@/components/knitwit-ui';
import { Colors } from '@/constants/theme';

// The web half of the auto-growing field. See auto-grow-input.tsx for what it's for.
//
// It can't measure the way native does. React Native Web renders a real <textarea>, and a
// textarea's scrollHeight never reports less than the height already set on it — so growing to
// 480px and then deleting most of the text still measures 480px, and the box never shrinks back.
// That is exactly what happened the first time this was written.
//
// So it collapses the element before measuring, which needs the DOM node rather than
// onContentSizeChange. Height is applied to the node directly and never passed through the style
// prop, so React Native Web has no opinion about it to overwrite; the layout effect re-applies it
// after every render anyway, before the browser paints.
export function AutoGrowInput({
  minHeight = 88,
  maxHeight = 480,
  style,
  value,
  ...props
}: AutoGrowInputProps) {
  const ref = useRef<TextInput | null>(null);

  const resize = useCallback(() => {
    const node = ref.current as unknown as HTMLTextAreaElement | null;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(maxHeight, Math.max(minHeight, node.scrollHeight))}px`;
  }, [minHeight, maxHeight]);

  useLayoutEffect(resize, [resize, value]);

  return (
    <TextInput
      ref={ref}
      multiline
      value={value}
      placeholderTextColor={Colors.inkSoft}
      // Fires for input the effect above can't see coming — a paste, an autofill, a drag-and-drop.
      onChange={resize}
      style={[styles.input, { minHeight }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: { ...InputStyle, textAlignVertical: 'top' },
});
