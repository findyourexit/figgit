/**
 * DTCG Utilities Tests
 *
 * Tests for DTCG transformation utilities including path construction,
 * type mapping, value conversion, and nested structure manipulation.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldBeDimension,
  convertToDimension,
  mapFigmaTypeToDtcg,
  buildTokenPath,
  setNestedValue,
  getNestedValue,
  convertAliasToDtcg,
  convertValue,
  type VariablePathMap,
} from '../src/util/dtcgUtils';
import type { VariableModeValue } from '../src/util/dtcgUtils';

describe('shouldBeDimension', () => {
  it('returns true for FLOAT type with "width" in name', () => {
    expect(shouldBeDimension('FLOAT', 'container-width')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'Width')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'max-width')).toBe(true);
  });

  it('returns true for FLOAT type with "height" in name', () => {
    expect(shouldBeDimension('FLOAT', 'button-height')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'Height')).toBe(true);
  });

  it('returns true for FLOAT type with spacing keywords', () => {
    expect(shouldBeDimension('FLOAT', 'padding-top')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'margin-left')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'spacing-xs')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'gap-medium')).toBe(true);
  });

  it('returns true for FLOAT type with border/radius keywords', () => {
    expect(shouldBeDimension('FLOAT', 'border-width')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'corner-radius')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'radius-lg')).toBe(true);
  });

  it('returns true for FLOAT type with position keywords', () => {
    expect(shouldBeDimension('FLOAT', 'offset-x')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'offset-y')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'top-position')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'left-inset')).toBe(true);
  });

  it('returns false for FLOAT type with no dimension keywords', () => {
    expect(shouldBeDimension('FLOAT', 'opacity')).toBe(false);
    expect(shouldBeDimension('FLOAT', 'scale')).toBe(false);
    expect(shouldBeDimension('FLOAT', 'rotation')).toBe(false);
    expect(shouldBeDimension('FLOAT', 'ratio')).toBe(false);
  });

  it('returns false for non-FLOAT types regardless of name', () => {
    expect(shouldBeDimension('COLOR', 'width')).toBe(false);
    expect(shouldBeDimension('STRING', 'padding')).toBe(false);
    expect(shouldBeDimension('BOOLEAN', 'size')).toBe(false);
  });

  it('handles case-insensitive matching', () => {
    expect(shouldBeDimension('FLOAT', 'WIDTH')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'PaDdInG')).toBe(true);
  });

  it('matches keywords anywhere in the name', () => {
    expect(shouldBeDimension('FLOAT', 'my-width-value')).toBe(true);
    expect(shouldBeDimension('FLOAT', 'some-padding-here')).toBe(true);
  });
});

describe('convertToDimension', () => {
  it('converts number to dimension with px unit', () => {
    expect(convertToDimension(16)).toEqual({ value: 16, unit: 'px' });
  });

  it('handles zero value', () => {
    expect(convertToDimension(0)).toEqual({ value: 0, unit: 'px' });
  });

  it('handles decimal values', () => {
    expect(convertToDimension(16.5)).toEqual({ value: 16.5, unit: 'px' });
  });

  it('handles large values', () => {
    expect(convertToDimension(1920)).toEqual({ value: 1920, unit: 'px' });
  });

  it('handles negative values', () => {
    expect(convertToDimension(-8)).toEqual({ value: -8, unit: 'px' });
  });
});

describe('mapFigmaTypeToDtcg', () => {
  it('maps COLOR to "color"', () => {
    expect(mapFigmaTypeToDtcg('COLOR')).toBe('color');
  });

  it('maps FLOAT to "dimension" when name suggests spatial measurement', () => {
    expect(mapFigmaTypeToDtcg('FLOAT', 'width')).toBe('dimension');
    expect(mapFigmaTypeToDtcg('FLOAT', 'padding')).toBe('dimension');
    expect(mapFigmaTypeToDtcg('FLOAT', 'spacing')).toBe('dimension');
  });

  it('maps FLOAT to "number" when name does not suggest dimension', () => {
    expect(mapFigmaTypeToDtcg('FLOAT', 'opacity')).toBe('number');
    expect(mapFigmaTypeToDtcg('FLOAT', 'scale')).toBe('number');
    expect(mapFigmaTypeToDtcg('FLOAT', 'ratio')).toBe('number');
  });

  it('maps STRING with "font" to "fontFamily"', () => {
    expect(mapFigmaTypeToDtcg('STRING', 'font-family')).toBe('fontFamily');
    expect(mapFigmaTypeToDtcg('STRING', 'Font')).toBe('fontFamily');
    expect(mapFigmaTypeToDtcg('STRING', 'primary-font')).toBe('fontFamily');
  });

  it('maps STRING without "font" to "string"', () => {
    expect(mapFigmaTypeToDtcg('STRING', 'label')).toBe('string');
    expect(mapFigmaTypeToDtcg('STRING', 'text-content')).toBe('string');
  });

  it('maps BOOLEAN to "boolean"', () => {
    expect(mapFigmaTypeToDtcg('BOOLEAN')).toBe('boolean');
  });

  it('maps unknown types to "string" as fallback', () => {
    expect(mapFigmaTypeToDtcg('UNKNOWN_TYPE')).toBe('string');
    expect(mapFigmaTypeToDtcg('CUSTOM')).toBe('string');
  });

  it('handles empty variable name gracefully', () => {
    expect(mapFigmaTypeToDtcg('FLOAT', '')).toBe('number');
    expect(mapFigmaTypeToDtcg('STRING', '')).toBe('string');
  });
});

describe('buildTokenPath', () => {
  describe('Option A: Use variable name if it contains dots', () => {
    it('uses variable name as-is when it contains dots', () => {
      expect(buildTokenPath('Colors', 'color.bg.default')).toBe('color.bg.default');
      expect(buildTokenPath('Spacing', 'spacing.base.sm')).toBe('spacing.base.sm');
    });

    it('ignores collection name when variable has dots', () => {
      expect(buildTokenPath('MyCollection', 'token.nested.path')).toBe('token.nested.path');
    });

    it('handles variable with single dot', () => {
      expect(buildTokenPath('Colors', 'bg.primary')).toBe('bg.primary');
    });

    it('handles variable with multiple dots', () => {
      expect(buildTokenPath('Tokens', 'a.b.c.d.e')).toBe('a.b.c.d.e');
    });
  });

  describe('Option B: Combine collection and variable when no dots', () => {
    it('combines collection and variable names', () => {
      expect(buildTokenPath('Colors', 'primary')).toBe('colors.primary');
      expect(buildTokenPath('Spacing', 'base')).toBe('spacing.base');
    });

    it('normalizes to lowercase', () => {
      expect(buildTokenPath('MyColors', 'Primary')).toBe('mycolors.primary');
      expect(buildTokenPath('SPACING', 'BASE')).toBe('spacing.base');
    });

    it('replaces spaces with hyphens', () => {
      expect(buildTokenPath('Color Palette', 'bg primary')).toBe('color-palette.bg-primary');
    });

    it('removes special characters', () => {
      expect(buildTokenPath('Colors!@#', 'bg$%^primary')).toBe('colors.bgprimary');
    });

    it('handles hyphenated names', () => {
      expect(buildTokenPath('Colors', 'bg-primary')).toBe('colors.bg-primary');
    });

    it('handles underscores', () => {
      expect(buildTokenPath('Colors', 'bg_primary')).toBe('colors.bgprimary');
    });

    it('handles numbers in names', () => {
      expect(buildTokenPath('Colors', 'gray-500')).toBe('colors.gray-500');
    });
  });

  describe('Edge cases', () => {
    it('handles empty collection name', () => {
      expect(buildTokenPath('', 'token')).toBe('.token');
    });

    it('handles single character names', () => {
      expect(buildTokenPath('A', 'b')).toBe('a.b');
    });

    it('handles very long names', () => {
      const longCollection = 'VeryLongCollectionNameWithManyCharacters';
      const longVariable = 'very-long-variable-name-with-many-segments';
      const result = buildTokenPath(longCollection, longVariable);
      expect(result).toContain('verylongcollectionnamewithmanycharacters');
      expect(result).toContain('very-long-variable-name-with-many-segments');
    });
  });
});

describe('setNestedValue', () => {
  it('sets value at single-level path', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'token', { $value: 'value' });
    expect(obj).toEqual({ token: { $value: 'value' } });
  });

  it('creates nested structure for multi-level path', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'color.bg.default', { $value: '#ffffff' });
    expect(obj).toEqual({
      color: {
        bg: {
          default: { $value: '#ffffff' },
        },
      },
    });
  });

  it('preserves existing sibling values', () => {
    const obj: Record<string, unknown> = {
      color: {
        bg: {
          primary: { $value: '#000000' },
        },
      },
    };
    setNestedValue(obj, 'color.bg.secondary', { $value: '#ffffff' });
    expect(obj).toEqual({
      color: {
        bg: {
          primary: { $value: '#000000' },
          secondary: { $value: '#ffffff' },
        },
      },
    });
  });

  it('overwrites existing value at path', () => {
    const obj: Record<string, unknown> = {
      color: { bg: { default: { $value: 'old' } } },
    };
    setNestedValue(obj, 'color.bg.default', { $value: 'new' });
    expect(obj.color).toHaveProperty('bg.default.$value', 'new');
  });

  it('handles deep nesting', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'a.b.c.d.e.f', { $value: 'deep' });
    expect(getNestedValue(obj, 'a.b.c.d.e.f')).toEqual({ $value: 'deep' });
  });

  it('creates intermediate objects as needed', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'level1.level2.level3', 'value');
    expect(obj.level1).toBeDefined();
    expect((obj.level1 as Record<string, unknown>).level2).toBeDefined();
  });

  it('handles paths with single segment', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'token', 'value');
    expect(obj.token).toBe('value');
  });
});

describe('getNestedValue', () => {
  it('retrieves value at single-level path', () => {
    const obj = { token: { $value: 'value' } };
    expect(getNestedValue(obj, 'token')).toEqual({ $value: 'value' });
  });

  it('retrieves value from nested structure', () => {
    const obj = {
      color: {
        bg: {
          default: { $value: '#ffffff' },
        },
      },
    };
    expect(getNestedValue(obj, 'color.bg.default')).toEqual({ $value: '#ffffff' });
  });

  it('returns undefined for non-existent path', () => {
    const obj = { color: { bg: {} } };
    expect(getNestedValue(obj, 'color.bg.nonexistent')).toBeUndefined();
  });

  it('returns undefined for partially existent path', () => {
    const obj = { color: {} };
    expect(getNestedValue(obj, 'color.bg.default')).toBeUndefined();
  });

  it('handles deep nesting', () => {
    const obj = { a: { b: { c: { d: { e: 'value' } } } } };
    expect(getNestedValue(obj, 'a.b.c.d.e')).toBe('value');
  });

  it('returns undefined when path traverses non-object', () => {
    const obj = { color: 'string-value' };
    expect(getNestedValue(obj, 'color.bg')).toBeUndefined();
  });
});

describe('convertAliasToDtcg', () => {
  it('converts variable ID to DTCG reference format', () => {
    const pathMap: VariablePathMap = new Map([['var-123', 'color.bg.primary']]);
    expect(convertAliasToDtcg('var-123', pathMap)).toBe('{color.bg.primary}');
  });

  it('wraps path in curly braces', () => {
    const pathMap: VariablePathMap = new Map([['var-456', 'spacing.base']]);
    const result = convertAliasToDtcg('var-456', pathMap);
    expect(result.startsWith('{')).toBe(true);
    expect(result.endsWith('}')).toBe(true);
  });

  it('throws error when variable ID not in map', () => {
    const pathMap: VariablePathMap = new Map();
    expect(() => convertAliasToDtcg('unknown-id', pathMap)).toThrow();
    expect(() => convertAliasToDtcg('unknown-id', pathMap)).toThrow(/Cannot resolve alias/);
  });

  it('handles deeply nested token paths', () => {
    const pathMap: VariablePathMap = new Map([
      ['var-789', 'design.system.color.brand.primary.500'],
    ]);
    expect(convertAliasToDtcg('var-789', pathMap)).toBe('{design.system.color.brand.primary.500}');
  });

  it('provides helpful error message with variable ID', () => {
    const pathMap: VariablePathMap = new Map();
    expect(() => convertAliasToDtcg('missing-var-id', pathMap)).toThrow('missing-var-id');
  });
});

describe('convertValue', () => {
  const pathMap: VariablePathMap = new Map([['ref-var-id', 'color.bg.primary']]);

  describe('Alias conversion', () => {
    it('converts ALIAS type to DTCG reference', () => {
      const modeValue: VariableModeValue = {
        type: 'ALIAS',
        refVariableId: 'ref-var-id',
      };
      expect(convertValue(modeValue, 'COLOR', 'my-color', pathMap)).toBe('{color.bg.primary}');
    });

    it('throws when alias references unknown variable', () => {
      const modeValue: VariableModeValue = {
        type: 'ALIAS',
        refVariableId: 'unknown-ref',
      };
      expect(() => convertValue(modeValue, 'COLOR', 'my-color', pathMap)).toThrow();
    });
  });

  describe('Color conversion', () => {
    it('converts COLOR type to DTCG color value', () => {
      const modeValue: VariableModeValue = {
        type: 'COLOR',
        value: { r: 1, g: 1, b: 1, a: 1 },
      };
      const result = convertValue(modeValue, 'COLOR', 'my-color', pathMap);
      expect(result).toHaveProperty('colorSpace', 'srgb');
      expect(result).toHaveProperty('hex', '#ffffff');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('alpha');
    });
  });

  describe('Number conversion', () => {
    it('converts NUMBER to dimension when name suggests spatial measurement', () => {
      const modeValue: VariableModeValue = {
        type: 'NUMBER',
        value: 16,
      };
      const result = convertValue(modeValue, 'FLOAT', 'padding', pathMap);
      expect(result).toEqual({ value: 16, unit: 'px' });
    });

    it('converts NUMBER to plain number when name does not suggest dimension', () => {
      const modeValue: VariableModeValue = {
        type: 'NUMBER',
        value: 0.5,
      };
      const result = convertValue(modeValue, 'FLOAT', 'opacity', pathMap);
      expect(result).toBe(0.5);
    });
  });

  describe('String conversion', () => {
    it('converts STRING type to string value', () => {
      const modeValue: VariableModeValue = {
        type: 'STRING',
        value: 'Arial',
      };
      expect(convertValue(modeValue, 'STRING', 'font-family', pathMap)).toBe('Arial');
    });
  });

  describe('Boolean conversion', () => {
    it('converts BOOLEAN type to boolean value', () => {
      const modeValueTrue: VariableModeValue = {
        type: 'BOOLEAN',
        value: true,
      };
      expect(convertValue(modeValueTrue, 'BOOLEAN', 'enabled', pathMap)).toBe(true);

      const modeValueFalse: VariableModeValue = {
        type: 'BOOLEAN',
        value: false,
      };
      expect(convertValue(modeValueFalse, 'BOOLEAN', 'enabled', pathMap)).toBe(false);
    });
  });

  describe('Unknown type handling', () => {
    it('returns value as-is for unknown type', () => {
      const modeValue = {
        type: 'UNKNOWN',
        value: 'some-value',
      } as unknown as VariableModeValue;
      expect(convertValue(modeValue, 'UNKNOWN', 'var', pathMap)).toBe('some-value');
    });
  });
});

describe('Integration: nested structure building', () => {
  it('builds complete DTCG token structure', () => {
    const root: Record<string, unknown> = {};

    // Add multiple tokens
    setNestedValue(root, 'color.bg.primary', {
      $value: { colorSpace: 'srgb', hex: '#000000', components: [0, 0, 0], alpha: 1 },
      $type: 'color',
    });

    setNestedValue(root, 'color.bg.secondary', {
      $value: { colorSpace: 'srgb', hex: '#ffffff', components: [1, 1, 1], alpha: 1 },
      $type: 'color',
    });

    setNestedValue(root, 'spacing.base', {
      $value: { value: 16, unit: 'px' },
      $type: 'dimension',
    });

    // Verify structure
    expect(root).toHaveProperty('color.bg.primary');
    expect(root).toHaveProperty('color.bg.secondary');
    expect(root).toHaveProperty('spacing.base');

    const bgPrimary = getNestedValue(root, 'color.bg.primary');
    expect(bgPrimary).toHaveProperty('$value');
    expect(bgPrimary).toHaveProperty('$type', 'color');
  });

  it('handles complex token hierarchy', () => {
    const root: Record<string, unknown> = {};

    const tokens = [
      { path: 'brand.primary.100', value: '#f0f0f0' },
      { path: 'brand.primary.500', value: '#808080' },
      { path: 'brand.primary.900', value: '#101010' },
      { path: 'brand.secondary.100', value: '#fff0f0' },
      { path: 'spacing.xs', value: 4 },
      { path: 'spacing.sm', value: 8 },
      { path: 'spacing.md', value: 16 },
    ];

    tokens.forEach(({ path, value }) => {
      setNestedValue(root, path, { $value: value });
    });

    expect(getNestedValue(root, 'brand.primary.500')).toHaveProperty('$value', '#808080');
    expect(getNestedValue(root, 'spacing.md')).toHaveProperty('$value', 16);
  });
});
