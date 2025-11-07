// Simple determinism test (node script)
// NOTE: This is a placeholder; running it outside Figma requires mocking the figma API.
// For real usage, you'd adapt with a lightweight mock or move stableStringify + hashing out for pure test.

import { stableStringify } from '../src/util/stableStringify';
import { sha256 } from '../src/export/hash';
import * as process from 'node:process';

async function run() {
  const sample = { b: 2, a: 1, nested: { z: 26, alpha: ['x', 'y'] } };
  const s1 = stableStringify(sample, 2);
  const s2 = stableStringify({ nested: { alpha: ['x', 'y'], z: 26 }, a: 1, b: 2 }, 2);
  if (s1 !== s2) {
    console.error('Stable stringify mismatch');
    process.exit(1);
  }
  const h1 = await sha256(s1);
  const h2 = await sha256(s2);
  if (h1 !== h2) {
    console.error('Hash mismatch');
    process.exit(1);
  }
  console.log('Determinism test passed. Hash:', h1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
