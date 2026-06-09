import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64 } from '../src/github/githubClient';

describe('base64 codec (sandbox-safe pure JS)', () => {
  const cases: Array<{ name: string; input: string }> = [
    { name: 'empty string', input: '' },
    { name: 'ascii', input: 'hello world' },
    { name: 'json', input: JSON.stringify({ a: 1, b: 'two', c: [3, 4] }) },
    { name: '2-byte sequence', input: 'café résumé' },
    { name: '3-byte sequence (CJK)', input: '设计令牌 デザイン' },
    { name: '4-byte sequence (emoji / surrogate pairs)', input: '🎨🚀✨ tokens' },
    { name: 'mixed widths', input: 'a©你🎉z' },
  ];

  it('encodes to standard base64 that matches the platform encoder for ASCII', () => {
    // For ASCII, our encoder must agree with btoa.
    expect(toBase64('hello world')).toBe(btoa('hello world'));
  });

  for (const { name, input } of cases) {
    it(`round-trips ${name}`, () => {
      expect(fromBase64(toBase64(input))).toBe(input);
    });
  }

  it('decodes base64 containing whitespace/newlines (as returned by the contents API)', () => {
    const encoded = toBase64('the quick brown fox jumps over the lazy dog');
    const chunked = encoded.replace(/(.{8})/g, '$1\n');
    expect(fromBase64(chunked)).toBe('the quick brown fox jumps over the lazy dog');
  });
});
