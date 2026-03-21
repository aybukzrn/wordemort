import { useWindowDimensions } from 'react-native';

/**
 * Returns a UI scale multiplier.
 * ~1.0 on 390pt phones, up to 1.6 on large iPads.
 */
export function useScale(): number {
  const { width } = useWindowDimensions();
  return Math.min(width / 390, 1.6);
}
