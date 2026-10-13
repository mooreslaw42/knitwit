import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

// The Apple and Google marks, for the sign-in buttons.
//
// Deliberately not part of the Knitwit icon set. Those are generated from `brand-kit` in one house
// style — 24px grid, 2px rounded strokes, soft duotone — and these two are not ours to restyle.
// Apple and Google both publish rules about their marks, and "drawn to match the rest of the app"
// breaks them. So: exact paths, Apple in one colour as its guidelines require, Google in its four.

type Props = {
  name: 'apple' | 'google';
  size?: number;
};

export function ProviderMark({ name, size = 18 }: Props) {
  if (name === 'apple') {
    return (
      // Monochrome, which is what Apple permits: black or white, nothing else.
      <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
        <Path
          fill={Colors.ink}
          d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        />
      </Svg>
    );
  }

  return (
    // The four-colour G. Google's guidelines allow this or an all-white version; on the cream
    // button the colour one is the correct choice.
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </Svg>
  );
}
