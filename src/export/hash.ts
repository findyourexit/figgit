/**
 * Pure JavaScript SHA-256 Implementation
 *
 * This module provides SHA-256 hashing without relying on Web Crypto API,
 * which is not available in the Figma plugin sandbox environment.
 *
 * Based on the SHA-256 specification (FIPS PUB 180-4):
 * https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf
 *
 * Reference implementation:
 * https://geraintluff.github.io/sha256/
 */

/**
 * Computes SHA-256 hash of a string using pure JavaScript.
 *
 * Process overview:
 * 1. Convert string to UTF-8 bytes
 * 2. Add padding to make length ≡ 448 (mod 512)
 * 3. Append original length as 64-bit big-endian integer
 * 4. Process message in 512-bit chunks
 * 5. Return 256-bit hash as hexadecimal string
 *
 * @param str - Input string to hash
 * @returns 64-character hexadecimal hash string
 *
 * @example
 * ```typescript
 * const hash = sha256Pure("hello world");
 * // Returns: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
 * ```
 */
function sha256Pure(str: string): string {
  const bytes = stringToUtf8Bytes(str);

  // SHA-256 round constants (first 32 bits of the fractional parts of cube roots of first 64 primes)
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  // Initial hash values (first 32 bits of the fractional parts of square roots of first 8 primes)
  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  // Pre-processing: add padding
  // Message length must be ≡ 448 (mod 512) bits, then append 64-bit length
  const msgLen = bytes.length;
  const bitLen = msgLen * 8;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64; // Round up to nearest 512-bit boundary
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80; // Append single '1' bit (and seven '0' bits as 0x80)

  // Append original message length as 64-bit big-endian integer
  for (let i = 0; i < 8; i++) {
    padded[paddedLen - 1 - i] = (bitLen >>> (i * 8)) & 0xff;
  }

  // Process message in 512-bit (64-byte) chunks
  for (let chunk = 0; chunk < paddedLen; chunk += 64) {
    const w = new Uint32Array(64); // Message schedule array

    // Copy chunk into first 16 words (big-endian)
    for (let i = 0; i < 16; i++) {
      w[i] =
        (padded[chunk + i * 4] << 24) |
        (padded[chunk + i * 4 + 1] << 16) |
        (padded[chunk + i * 4 + 2] << 8) |
        padded[chunk + i * 4 + 3];
    }

    // Extend the first 16 words into the remaining 48 words
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    // Initialize working variables to current hash value
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    // Main compression loop (64 rounds)
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      // Rotate working variables
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    // Add compressed chunk to current hash value
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  // Produce final hash as 64-character hexadecimal string
  const hash = [h0, h1, h2, h3, h4, h5, h6, h7];
  return hash.map((h) => h.toString(16).padStart(8, '0')).join('');
}

/**
 * Performs a right rotation (circular shift) on a 32-bit unsigned integer.
 *
 * Used in SHA-256's sigma (Σ) and Ch/Maj functions.
 *
 * @param n - The 32-bit number to rotate
 * @param x - Number of positions to rotate right
 * @returns Rotated 32-bit unsigned integer
 *
 * @example
 * ```typescript
 * rotr(0b11110000111100001111000011110000, 4)
 * // Returns: 0b00001111000011110000111100001111
 * ```
 */
function rotr(n: number, x: number): number {
  return (n >>> x) | (n << (32 - x));
}

/**
 * Converts a JavaScript string to UTF-8 encoded byte array.
 *
 * Manually implements UTF-8 encoding since TextEncoder is not available
 * in the Figma plugin sandbox.
 *
 * Handles all Unicode characters including:
 * - ASCII (1 byte): U+0000 to U+007F
 * - 2-byte sequences: U+0080 to U+07FF
 * - 3-byte sequences: U+0800 to U+FFFF
 * - 4-byte sequences: U+10000 to U+10FFFF (surrogate pairs)
 *
 * @param str - JavaScript string to convert
 * @returns Uint8Array containing UTF-8 encoded bytes
 *
 * @example
 * ```typescript
 * stringToUtf8Bytes("hello")   // [104, 101, 108, 108, 111]
 * stringToUtf8Bytes("hello 世界") // [104, 101, 108, 108, 111, 32, 228, 184, 150, 231, 149, 140]
 * ```
 */
function stringToUtf8Bytes(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);

    // 1-byte sequence (ASCII): 0xxxxxxx
    if (charCode < 0x80) {
      bytes.push(charCode);
    }
    // 2-byte sequence: 110xxxxx 10xxxxxx
    else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    }
    // 3-byte sequence: 1110xxxx 10xxxxxx 10xxxxxx
    else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
    // 4-byte sequence (surrogate pair): 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
    else {
      i++; // Consume next character (low surrogate)
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

export async function sha256(text: string): Promise<string> {
  // Use pure JS implementation since crypto.subtle is not available in Figma plugin sandbox
  return sha256Pure(text);
}
