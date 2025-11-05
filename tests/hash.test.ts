/**
 * SHA-256 Hash Tests
 *
 * Tests for the pure JavaScript SHA-256 implementation.
 */

import { describe, it, expect } from 'vitest';
import { sha256 } from '../src/export/hash';

describe('sha256', () => {
  it('hashes empty string to consistent value', async () => {
    const result = await sha256('');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    // Verify it's the same each time
    expect(await sha256('')).toBe(result);
  });

  it('hashes "hello world" to consistent value', async () => {
    const result = await sha256('hello world');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    // Verify it's the same each time
    expect(await sha256('hello world')).toBe(result);
  });

  it('hashes complex string to consistent value', async () => {
    const result = await sha256('The quick brown fox jumps over the lazy dog');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    expect(await sha256('The quick brown fox jumps over the lazy dog')).toBe(result);
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await sha256('test1');
    const hash2 = await sha256('test2');
    expect(hash1).not.toBe(hash2);
  });

  it('produces same hash for same input', async () => {
    const hash1 = await sha256('consistent');
    const hash2 = await sha256('consistent');
    expect(hash1).toBe(hash2);
  });

  it('handles Unicode characters correctly', async () => {
    const result = await sha256('Hello 世界 🌍');
    // Should produce consistent hash
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles JSON strings', async () => {
    const json = JSON.stringify({ key: 'value', number: 42, nested: { prop: true } });
    const result = await sha256(json);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns lowercase hexadecimal string', async () => {
    const result = await sha256('test');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    expect(result).toBe(result.toLowerCase());
  });

  it('returns exactly 64 characters', async () => {
    const inputs = ['', 'a', 'short', 'a much longer string with many characters'];
    for (const input of inputs) {
      expect(await sha256(input)).toHaveLength(64);
    }
  });

  it('handles multiline strings', async () => {
    const multiline = `line1
line2
line3`;
    const result = await sha256(multiline);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for complex JSON structures', async () => {
    const complexObj = {
      collections: [
        {
          id: 'col1',
          name: 'Colors',
          variables: [
            { id: 'v1', name: 'primary', value: '#FF0000' },
            { id: 'v2', name: 'secondary', value: '#00FF00' },
          ],
        },
      ],
      meta: {
        timestamp: '2024-01-01T00:00:00Z',
        version: '1.0',
      },
    };

    const json = JSON.stringify(complexObj);
    const hash1 = await sha256(json);
    const hash2 = await sha256(json);

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for similar but different JSON', async () => {
    const json1 = JSON.stringify({ order: 'A', value: 1 });
    const json2 = JSON.stringify({ order: 'B', value: 1 });

    expect(await sha256(json1)).not.toBe(await sha256(json2));
  });
});
