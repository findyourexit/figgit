/**
 * Deterministic JSON stringification for stable git diffs.
 *
 * Recursively sorts object keys alphabetically to ensure that the same object
 * always produces the same JSON string, regardless of the order in which keys
 * were added. This is essential for:
 *
 * - Generating consistent content hashes for change detection
 * - Producing clean, predictable git diffs
 * - Avoiding spurious changes in version control
 *
 * Arrays maintain their original order (not sorted). Only object keys are sorted.
 *
 * @param obj - Any JSON-serializable value (object, array, primitive)
 * @param space - Indentation for pretty-printing (default: 2 spaces)
 * @returns Deterministic JSON string representation
 *
 * @example
 * ```typescript
 * const obj = { b: 2, a: 1 };
 * stableStringify(obj);
 * // Returns: '{\n  "a": 1,\n  "b": 2\n}'
 * ```
 */
export function stableStringify(obj: any, space = 2): string {
  return JSON.stringify(sortValue(obj), null, space);
}

/**
 * Recursively sorts object keys while preserving array order.
 *
 * @param val - Value to process
 * @returns Sorted copy if object, mapped copy if array, or original value if primitive
 */
function sortValue(val: any): any {
  // Arrays: recursively process elements but maintain order
  if (Array.isArray(val)) return val.map(sortValue);

  // Objects: sort keys alphabetically and recursively process values
  if (val && typeof val === 'object' && val.constructor === Object) {
    return Object.keys(val)
      .sort() // Lexicographic sort ensures consistent ordering
      .reduce(
        (acc, key) => {
          acc[key] = sortValue(val[key]);
          return acc;
        },
        {} as Record<string, any>
      );
  }

  // Primitives: return as-is
  return val;
}
