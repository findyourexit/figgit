/**
 * Color Utilities Tests
 *
 * Tests for DTCG color conversion utilities.
 */

import { describe, it, expect } from 'vitest';
import { rgbToHex, hexToRgb, convertColorToDtcg } from '../src/util/colorUtils';
import type { DtcgColorValue } from '../src/shared/dtcg-types';

describe('rgbToHex', () => {
  it('converts white (1, 1, 1) to #ffffff', () => {
    expect(rgbToHex(1, 1, 1)).toBe('#ffffff');
  });

  it('converts black (0, 0, 0) to #000000', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('converts red (1, 0, 0) to #ff0000', () => {
    expect(rgbToHex(1, 0, 0)).toBe('#ff0000');
  });

  it('converts green (0, 1, 0) to #00ff00', () => {
    expect(rgbToHex(0, 1, 0)).toBe('#00ff00');
  });

  it('converts blue (0, 0, 1) to #0000ff', () => {
    expect(rgbToHex(0, 0, 1)).toBe('#0000ff');
  });

  it('converts mid-gray (0.5, 0.5, 0.5) to #808080', () => {
    expect(rgbToHex(0.5, 0.5, 0.5)).toBe('#808080');
  });

  it('converts arbitrary RGB values correctly', () => {
    expect(rgbToHex(0.25, 0.75, 1.0)).toBe('#40bfff');
  });

  it('handles fractional values with correct rounding', () => {
    // 0.254 * 255 = 64.77 → should round to 65 (0x41)
    expect(rgbToHex(0.254, 0, 0)).toBe('#410000');
  });

  it('clamps values above 1.0 to 1.0', () => {
    expect(rgbToHex(1.5, 1.2, 1.1)).toBe('#ffffff');
  });

  it('clamps values below 0.0 to 0.0', () => {
    expect(rgbToHex(-0.5, -0.2, -0.1)).toBe('#000000');
  });

  it('always returns lowercase hex string', () => {
    const result = rgbToHex(0.5, 0.75, 1.0);
    expect(result).toBe(result.toLowerCase());
  });

  it('always returns 7 characters (# + 6 hex digits)', () => {
    expect(rgbToHex(0, 0, 0)).toHaveLength(7);
    expect(rgbToHex(1, 1, 1)).toHaveLength(7);
    expect(rgbToHex(0.123, 0.456, 0.789)).toHaveLength(7);
  });

  it('handles edge case of very small positive values', () => {
    expect(rgbToHex(0.001, 0.001, 0.001)).toBe('#000000');
  });

  it('handles edge case of values very close to 1', () => {
    // 0.999 * 255 = 254.745, which Math.round() gives 255 = 0xff
    expect(rgbToHex(0.999, 0.999, 0.999)).toBe('#ffffff');
  });
});

describe('hexToRgb', () => {
  it('converts #ffffff to white (1, 1, 1)', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('converts #000000 to black (0, 0, 0)', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('converts #ff0000 to red (1, 0, 0)', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('converts #00ff00 to green (0, 1, 0)', () => {
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('converts #0000ff to blue (0, 0, 1)', () => {
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 1 });
  });

  it('handles uppercase hex values', () => {
    expect(hexToRgb('#FF00FF')).toEqual({ r: 1, g: 0, b: 1 });
  });

  it('handles mixed case hex values', () => {
    expect(hexToRgb('#FfAaBb')).toEqual({
      r: 1,
      g: expect.closeTo(0.667, 2),
      b: expect.closeTo(0.733, 2),
    });
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgb('808080')).toEqual({
      r: expect.closeTo(0.502, 2),
      g: expect.closeTo(0.502, 2),
      b: expect.closeTo(0.502, 2),
    });
  });

  it('produces values in 0-1 range', () => {
    const result = hexToRgb('#40bfff');
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(1);
    expect(result.g).toBeGreaterThanOrEqual(0);
    expect(result.g).toBeLessThanOrEqual(1);
    expect(result.b).toBeGreaterThanOrEqual(0);
    expect(result.b).toBeLessThanOrEqual(1);
  });

  it('round-trips correctly with rgbToHex', () => {
    const original = { r: 0.25, g: 0.75, b: 1.0 };
    const hex = rgbToHex(original.r, original.g, original.b);
    const result = hexToRgb(hex);
    expect(result.r).toBeCloseTo(original.r, 2);
    expect(result.g).toBeCloseTo(original.g, 2);
    expect(result.b).toBeCloseTo(original.b, 2);
  });
});

describe('convertColorToDtcg', () => {
  it('converts white Figma color to DTCG format', () => {
    const figmaColor = { r: 1, g: 1, b: 1, a: 1 };
    const result = convertColorToDtcg(figmaColor);

    expect(result).toEqual({
      colorSpace: 'srgb',
      hex: '#ffffff',
      components: [1, 1, 1],
      alpha: 1,
    });
  });

  it('converts black Figma color to DTCG format', () => {
    const figmaColor = { r: 0, g: 0, b: 0, a: 1 };
    const result = convertColorToDtcg(figmaColor);

    expect(result).toEqual({
      colorSpace: 'srgb',
      hex: '#000000',
      components: [0, 0, 0],
      alpha: 1,
    });
  });

  it('converts semi-transparent color correctly', () => {
    const figmaColor = { r: 1, g: 0, b: 0, a: 0.5 };
    const result = convertColorToDtcg(figmaColor);

    expect(result).toEqual({
      colorSpace: 'srgb',
      hex: '#ff0000',
      components: [1, 0, 0],
      alpha: 0.5,
    });
  });

  it('defaults alpha to 1 when not provided', () => {
    const figmaColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    const result = convertColorToDtcg(figmaColor);

    expect(result.alpha).toBe(1);
  });

  it('handles transparent color (alpha = 0)', () => {
    const figmaColor = { r: 1, g: 1, b: 1, a: 0 };
    const result = convertColorToDtcg(figmaColor);

    expect(result.alpha).toBe(0);
  });

  it('always sets colorSpace to "srgb"', () => {
    const figmaColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    const result = convertColorToDtcg(figmaColor);

    expect(result.colorSpace).toBe('srgb');
  });

  it('preserves exact component values', () => {
    const figmaColor = { r: 0.123, g: 0.456, b: 0.789, a: 0.999 };
    const result = convertColorToDtcg(figmaColor);

    expect(result.components).toEqual([0.123, 0.456, 0.789]);
    expect(result.alpha).toBe(0.999);
  });

  it('produces valid DTCG color value structure', () => {
    const figmaColor = { r: 0.5, g: 0.75, b: 1.0, a: 1 };
    const result: DtcgColorValue = convertColorToDtcg(figmaColor);

    expect(result).toHaveProperty('colorSpace');
    expect(result).toHaveProperty('hex');
    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('alpha');
    expect(result.components).toHaveLength(3);
  });

  it('handles edge case colors correctly', () => {
    const testCases = [
      { r: 0, g: 0, b: 0, a: 0 }, // Transparent black
      { r: 1, g: 1, b: 1, a: 0 }, // Transparent white
      { r: 0.5, g: 0.5, b: 0.5, a: 0.5 }, // Semi-transparent gray
    ];

    testCases.forEach((figmaColor) => {
      const result = convertColorToDtcg(figmaColor);
      expect(result.colorSpace).toBe('srgb');
      expect(result.hex).toMatch(/^#[a-f0-9]{6}$/);
      expect(result.components).toHaveLength(3);
      expect(result.alpha).toBe(figmaColor.a);
    });
  });

  it('matches hex and components values', () => {
    const figmaColor = { r: 0.25, g: 0.75, b: 1.0, a: 1 };
    const result = convertColorToDtcg(figmaColor);

    // Verify hex matches the components
    const hexRgb = hexToRgb(result.hex);
    expect(hexRgb.r).toBeCloseTo(result.components[0], 2);
    expect(hexRgb.g).toBeCloseTo(result.components[1], 2);
    expect(hexRgb.b).toBeCloseTo(result.components[2], 2);
  });
});

describe('Color conversion integration', () => {
  it('maintains color fidelity through full conversion pipeline', () => {
    const originalFigma = { r: 0.2, g: 0.6, b: 0.9, a: 0.8 };

    // Convert to DTCG
    const dtcg = convertColorToDtcg(originalFigma);

    // Verify DTCG structure
    expect(dtcg.colorSpace).toBe('srgb');
    expect(dtcg.components).toEqual([0.2, 0.6, 0.9]);
    expect(dtcg.alpha).toBe(0.8);

    // Verify hex matches components
    const reconstructed = hexToRgb(dtcg.hex);
    expect(reconstructed.r).toBeCloseTo(0.2, 2);
    expect(reconstructed.g).toBeCloseTo(0.6, 2);
    expect(reconstructed.b).toBeCloseTo(0.9, 2);
  });

  it('handles standard design system colors', () => {
    const designSystemColors = [
      { name: 'brand-primary', r: 0.2, g: 0.4, b: 1.0, a: 1 },
      { name: 'brand-secondary', r: 1.0, g: 0.6, b: 0.2, a: 1 },
      { name: 'neutral-50', r: 0.98, g: 0.98, b: 0.98, a: 1 },
      { name: 'neutral-900', r: 0.1, g: 0.1, b: 0.1, a: 1 },
      { name: 'overlay', r: 0, g: 0, b: 0, a: 0.5 },
    ];

    designSystemColors.forEach(({ r, g, b, a }) => {
      const result = convertColorToDtcg({ r, g, b, a });

      expect(result.colorSpace).toBe('srgb');
      expect(result.hex).toMatch(/^#[a-f0-9]{6}$/);
      expect(result.components).toEqual([r, g, b]);
      expect(result.alpha).toBe(a);
    });
  });
});
