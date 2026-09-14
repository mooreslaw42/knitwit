import { useWindowDimensions } from 'react-native';

// Above this, a screen may lay itself out in two columns.
//
// 1100px: an iPad in portrait (820–834, or 1024 on the 13") keeps one column, and every iPad in
// landscape (1180–1366) gets two, as does any desktop. Rotating the tablet is therefore a real
// layout change, which is the intent — landscape is where the second column has somewhere to go.
export const WideBreakpoint = 1100;

// Opt-in per screen rather than a global width bump: a list of rows at 1400px is worse to read,
// not better. Only screens with genuinely two things to look at call this.
export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= WideBreakpoint;
}
