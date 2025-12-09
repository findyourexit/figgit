import type { VariableModeValue } from '../util/dtcgUtils';

/**
 * Normalizes a variable's mode value into a structured format shared across
 * export builders.
 */
export function normalizeModeValue(raw: unknown): VariableModeValue {
  if (!raw || typeof raw !== 'object') {
    return inferPrimitive(raw);
  }

  const obj = raw as Record<string, unknown>;

  if (obj.type === 'VARIABLE_ALIAS' && typeof obj.id === 'string') {
    return { type: 'ALIAS', refVariableId: obj.id };
  }

  if (typeof obj.r === 'number' && typeof obj.g === 'number' && typeof obj.b === 'number') {
    return {
      type: 'COLOR',
      value: {
        r: obj.r,
        g: obj.g,
        b: obj.b,
        a: typeof obj.a === 'number' ? obj.a : 1,
      },
    };
  }

  return inferPrimitive(raw);
}

function inferPrimitive(val: unknown): VariableModeValue {
  switch (typeof val) {
    case 'string':
      return { type: 'STRING', value: val };
    case 'number':
      return { type: 'NUMBER', value: val };
    case 'boolean':
      return { type: 'BOOLEAN', value: val };
    default:
      return { type: 'STRING', value: String(val) };
  }
}
