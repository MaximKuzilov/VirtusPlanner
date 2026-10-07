import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Base design reference (standard mid-range Android, 360×800)
const BASE_W = 360;
const BASE_H = 800;

const scaleW = SCREEN_W / BASE_W;
const scaleH = SCREEN_H / BASE_H;

/**
 * Scale a horizontal/width dimension proportionally to screen width.
 */
export const rw = (size: number): number =>
  Math.round(PixelRatio.roundToNearestPixel(size * scaleW));

/**
 * Scale a vertical/height dimension proportionally to screen height.
 */
export const rh = (size: number): number =>
  Math.round(PixelRatio.roundToNearestPixel(size * scaleH));

/**
 * Scale a font size. Uses a moderate factor (0.5) so text doesn't
 * grow/shrink too aggressively on very large or small screens.
 */
export const rf = (size: number, factor = 0.5): number => {
  const scaledSize = size + (size * scaleW - size) * factor;
  return Math.round(PixelRatio.roundToNearestPixel(scaledSize));
};

/**
 * Moderate scale — applies width scaling with a dampening factor.
 * Good for padding, margins and border-radius.
 */
export const ms = (size: number, factor = 0.5): number =>
  Math.round(size + (rw(size) - size) * factor);

// Convenience exports
export const WINDOW_WIDTH = SCREEN_W;
export const WINDOW_HEIGHT = SCREEN_H;

export const isSmallPhone  = SCREEN_W < 360;                        // e.g. 320px
export const isMediumPhone = SCREEN_W >= 360 && SCREEN_W < 412;    // e.g. 360–411px
export const isLargePhone  = SCREEN_W >= 412 && SCREEN_W < 600;    // e.g. 412–599px
export const isTablet      = SCREEN_W >= 600;
