import { describe, it, expect } from 'vitest';
import { stableStringify } from '../src/util/stableStringify';

describe('stableStringify', () => {
  it('should stringify a simple object', () => {
    const obj = { name: 'test', value: 42 };
    const result = stableStringify(obj, 0);
    expect(result).toBe('{"name":"test","value":42}');
  });

  it('should sort object keys alphabetically for deterministic output', () => {
    const obj = { z: 3, a: 1, m: 2 };
    const result = stableStringify(obj, 0);
    expect(result).toBe('{"a":1,"m":2,"z":3}');
  });

  it('should handle nested objects with sorted keys', () => {
    const obj = {
      zebra: { nested: 'value', aardvark: 'first' },
      apple: 'fruit',
    };
    const result = stableStringify(obj, 0);
    expect(result).toBe('{"apple":"fruit","zebra":{"aardvark":"first","nested":"value"}}');
  });

  it('should handle arrays without sorting elements', () => {
    const obj = { items: [3, 1, 2], name: 'test' };
    const result = stableStringify(obj, 0);
    expect(result).toBe('{"items":[3,1,2],"name":"test"}');
  });

  it('should format with indentation when space parameter is provided', () => {
    const obj = { b: 2, a: 1 };
    const result = stableStringify(obj, 2);
    expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('should handle null and undefined values', () => {
    const obj = { a: null, b: undefined, c: 'value' };
    const result = stableStringify(obj, 0);
    // undefined values are omitted in JSON
    expect(result).toBe('{"a":null,"c":"value"}');
  });

  it('should handle primitive types', () => {
    expect(stableStringify('string', 0)).toBe('"string"');
    expect(stableStringify(123, 0)).toBe('123');
    expect(stableStringify(true, 0)).toBe('true');
    expect(stableStringify(null, 0)).toBe('null');
  });

  it('should handle deeply nested objects', () => {
    const obj = {
      level1: {
        z: 'last',
        a: {
          nested: {
            deep: 'value',
            another: 'key',
          },
        },
      },
    };
    const result = stableStringify(obj, 0);
    const expected = '{"level1":{"a":{"nested":{"another":"key","deep":"value"}},"z":"last"}}';
    expect(result).toBe(expected);
  });

  it('should produce consistent output for the same object', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { m: 3, z: 1, a: 2 };
    expect(stableStringify(obj1, 0)).toBe(stableStringify(obj2, 0));
  });

  it('should handle objects with numeric keys by sorting them lexicographically', () => {
    const obj = { 10: 'ten', 2: 'two', 1: 'one' };
    const result = stableStringify(obj, 0);
    // Numeric keys are sorted lexicographically: "1" < "2" < "10"
    expect(result).toBe('{"1":"one","2":"two","10":"ten"}');
  });

  it('should handle mixed object and array nesting', () => {
    const obj = {
      collection: [
        { name: 'second', id: 2 },
        { name: 'first', id: 1 },
      ],
      metadata: { version: 1 },
    };
    const result = stableStringify(obj, 0);
    // Array order preserved, object keys sorted
    expect(result).toBe(
      '{"collection":[{"id":2,"name":"second"},{"id":1,"name":"first"}],"metadata":{"version":1}}'
    );
  });
});
