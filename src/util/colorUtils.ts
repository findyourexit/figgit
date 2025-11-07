/**
 * Color Utility Functions
 *
 * Utilities for color format conversion, specifically for DTCG compliance.
 */

import { DtcgColorValue } from '../shared/dtcg-types';

/**
 * Converts a single RGB component (0-1 range) to a hex string (00-FF)
 *
 * @param component - RGB component value in range [0, 1]
 * @returns Two-character hex string (e.g., "ff", "00", "a3")
 */
function componentToHex(component: number): string {
  const clamped = Math.max(0, Math.min(1, component)); // Clamp to [0, 1]
  const scaled = Math.round(clamped * 255); // Scale to [0, 255]
  return scaled.toString(16).padStart(2, '0');
}

/**
 * Converts RGB values (0-1 range) to a hex color string
 *
 * @param r - Red component in range [0, 1]
 * @param g - Green component in range [0, 1]
 * @param b - Blue component in range [0, 1]
 * @returns Hex color string in format "#RRGGBB"
 *
 * @example
 * ```typescript
 * rgbToHex(1, 0, 0) // "#ff0000" (red)
 * rgbToHex(0, 0.4, 0.8) // "#0066cc" (blue)
 * rgbToHex(1, 1, 1) // "#ffffff" (white)
 * ```
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

/**
 * Converts a Figma color object to DTCG color value format
 *
 * Figma colors use 0-1 range for all components.
 * DTCG requires the same range plus colorSpace and hex representation.
 *
 * @param figmaColor - Figma color object with r, g, b, a properties
 * @returns DTCG-compliant color value object
 *
 * @example
 * ```typescript
 * const figmaColor = { r: 0, g: 0.4, b: 0.8, a: 1 };
 * const dtcgColor = convertColorToDtcg(figmaColor);
 * // {
 * //   colorSpace: 'srgb',
 * //   components: [0, 0.4, 0.8],
 * //   alpha: 1,
 * //   hex: '#0066cc'
 * // }
 * ```
 */
export function convertColorToDtcg(figmaColor: {
  r: number;
  g: number;
  b: number;
  a: number;
}): DtcgColorValue {
  return {
    colorSpace: 'srgb',
    components: [figmaColor.r, figmaColor.g, figmaColor.b],
    alpha: figmaColor.a ?? 1,
    hex: rgbToHex(figmaColor.r, figmaColor.g, figmaColor.b),
  };
}

/**
 * Converts a hex color string to RGB components (0-1 range)
 *
 * Useful for parsing colors back from hex format.
 *
 * @param hex - Hex color string (e.g., "#ff0066" or "ff0066")
 * @returns Object with r, g, b components in range [0, 1]
 *
 * @example
 * ```typescript
 * hexToRgb('#0066cc') // { r: 0, g: 0.4, b: 0.8 }
 * hexToRgb('ffffff') // { r: 1, g: 1, b: 1 }
 * ```
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  return { r, g, b };
}
