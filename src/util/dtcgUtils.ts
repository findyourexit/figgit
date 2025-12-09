/**
 * DTCG Transformation Utilities
 *
 * Functions for converting Figma variables to DTCG-compliant design tokens.
 */

import { DtcgTokenType, DtcgTokenValue, DtcgDimensionValue } from '../shared/dtcg-types';
import { convertColorToDtcg } from './colorUtils';

/**
 * Normalized representation of a Figma variable mode value used by DTCG utilities.
 */
export interface VariableModeValue {
  type: 'COLOR' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ALIAS';
  value?: string | number | boolean | { r: number; g: number; b: number; a: number };
  refVariableId?: string;
}

/**
 * Map of Figma variable IDs to DTCG token paths
 */
export type VariablePathMap = Map<string, string>;

/**
 * Determines if a Figma FLOAT type should be treated as a dimension (with unit)
 * or a plain number (unitless).
 *
 * Uses heuristics based on the variable name to make this determination.
 *
 * @param figmaType - Figma's resolved type (e.g., "FLOAT", "COLOR")
 * @param variableName - The variable's name
 * @returns true if it should be a dimension, false if plain number
 */
export function shouldBeDimension(figmaType: string, variableName: string): boolean {
  // Only FLOAT types can be dimensions
  if (figmaType !== 'FLOAT') return false;

  // Keywords that suggest a dimension (spatial measurement)
  // Use word boundaries to avoid false matches (e.g., 'y' in 'opacity')
  const dimensionKeywords = [
    'width',
    'height',
    'size',
    'padding',
    'margin',
    'spacing',
    'gap',
    'radius',
    'border',
    'offset',
    'top',
    'bottom',
    'left',
    'right',
    'inset',
    'stroke',
    'corner',
  ];

  const lowerName = variableName.toLowerCase();

  // Check for dimension keywords
  if (dimensionKeywords.some((keyword) => lowerName.includes(keyword))) {
    return true;
  }

  // Check for coordinate names (with word boundaries to avoid false positives)
  // Match '-x', '-y', 'x-', 'y-', or standalone 'x', 'y'
  return /(?:^|[-_])([xy])(?:[-_]|$)/i.test(variableName);
}

/**
 * Converts a number value to a DTCG dimension value.
 *
 * Figma typically uses pixels, so we default to "px" unit.
 *
 * @param value - The numeric value
 * @returns DTCG dimension value with "px" unit
 */
export function convertToDimension(value: number): DtcgDimensionValue {
  return {
    value,
    unit: 'px',
  };
}

/**
 * Maps Figma's variable type to DTCG token type.
 *
 * Some types require the variable name for context (e.g., FLOAT → dimension vs number).
 *
 * @param figmaType - Figma's resolved type
 * @param variableName - Variable name for context
 * @returns DTCG token type
 */
export function mapFigmaTypeToDtcg(figmaType: string, variableName: string = ''): DtcgTokenType {
  switch (figmaType) {
    case 'COLOR':
      return 'color';

    case 'FLOAT':
      // Use heuristics to determine if it's a dimension or plain number
      return shouldBeDimension(figmaType, variableName) ? 'dimension' : 'number';

    case 'STRING':
      // Check if it's a font family
      if (variableName.toLowerCase().includes('font')) {
        return 'fontFamily';
      }
      return 'string';

    case 'BOOLEAN':
      return 'boolean';

    default:
      // Fallback to string for unknown types
      return 'string';
  }
}

/**
 * Builds a DTCG token path from collection name and variable name.
 *
 * Strategy (per decision):
 * - Option A: If variable name contains dots, use it as-is (e.g., "color.bg.default")
 * - Option B (fallback): Combine collection + variable name (e.g., "colors" + "bg-primary")
 *
 * @param collectionName - Figma collection name
 * @param variableName - Figma variable name
 * @returns Dot-separated token path
 *
 * @example
 * ```typescript
 * buildTokenPath('Colors', 'bg.default') // "bg.default"
 * buildTokenPath('Colors', 'bg-primary') // "colors.bg-primary"
 * buildTokenPath('Spacing', 'base') // "spacing.base"
 * ```
 */
export function buildTokenPath(collectionName: string, variableName: string): string {
  // Option A: Use variable name as-is if it contains dots
  if (variableName.includes('.')) {
    return variableName;
  }

  // Option B: Combine collection and variable name
  const collectionSegment = collectionName
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove special chars

  const variableSegment = variableName
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove special chars

  return `${collectionSegment}.${variableSegment}`;
}

/**
 * Sets a value in a nested object structure based on a dot-separated path.
 * Creates intermediate objects as needed.
 *
 * @param obj - The root object to modify
 * @param path - Dot-separated path (e.g., "color.bg.default")
 * @param value - The token object to set
 *
 * @example
 * ```typescript
 * const root = {};
 * setNestedValue(root, 'color.bg.default', tokenObject);
 * // root is now { color: { bg: { default: tokenObject } } }
 * ```
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  // Navigate/create nested structure
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  // Set the value at the final position
  const finalKey = parts[parts.length - 1];
  current[finalKey] = value;
}

/**
 * Converts a Figma alias reference to DTCG reference format.
 *
 * @param refVariableId - Figma variable ID being referenced
 * @param variablePathMap - Map of variable IDs to token paths
 * @returns DTCG reference string in format "{path.to.token}"
 * @throws Error if the variable ID is not found in the map
 */
export function convertAliasToDtcg(
  refVariableId: string,
  variablePathMap: VariablePathMap
): string {
  const path = variablePathMap.get(refVariableId);

  if (!path) {
    throw new Error(`Cannot resolve alias: variable ID "${refVariableId}" not found in path map`);
  }

  return `{${path}}`;
}

/**
 * Converts a Figma variable mode value to DTCG token value format.
 *
 * Handles all value types: colors, dimensions, numbers, strings, booleans, and aliases.
 *
 * @param modeValue - Figma variable mode value
 * @param figmaType - Figma's resolved type for context
 * @param variableName - Variable name for context
 * @param variablePathMap - Map for resolving aliases
 * @returns DTCG-compliant token value
 */
export function convertValue(
  modeValue: VariableModeValue,
  figmaType: string,
  variableName: string,
  variablePathMap: VariablePathMap
): DtcgTokenValue {
  // Handle alias/reference
  if (modeValue.type === 'ALIAS' && modeValue.refVariableId) {
    return convertAliasToDtcg(modeValue.refVariableId, variablePathMap);
  }

  // Handle typed values
  switch (modeValue.type) {
    case 'COLOR':
      // Type guard: ensure value is a color object
      if (modeValue.value && typeof modeValue.value === 'object' && 'r' in modeValue.value) {
        return convertColorToDtcg(
          modeValue.value as { r: number; g: number; b: number; a: number }
        );
      }
      throw new Error(`Invalid color value for variable ${variableName}`);

    case 'NUMBER':
      // Type guard: ensure value is a number
      if (typeof modeValue.value === 'number') {
        // Check if it should be a dimension
        if (shouldBeDimension(figmaType, variableName)) {
          return convertToDimension(modeValue.value);
        }
        return modeValue.value;
      }
      throw new Error(`Invalid number value for variable ${variableName}`);

    case 'STRING':
      // Type guard: ensure value is a string
      if (typeof modeValue.value === 'string') {
        return modeValue.value;
      }
      throw new Error(`Invalid string value for variable ${variableName}`);

    case 'BOOLEAN':
      // Type guard: ensure value is a boolean
      if (typeof modeValue.value === 'boolean') {
        return modeValue.value;
      }
      throw new Error(`Invalid boolean value for variable ${variableName}`);

    default:
      // Fallback: return value if it exists
      if (modeValue.value !== undefined) {
        return modeValue.value as DtcgTokenValue;
      }
      throw new Error(`Missing value for variable ${variableName}`);
  }
}

/**
 * Gets a value from a nested object using a dot-separated path.
 *
 * @param obj - The object to query
 * @param path - Dot-separated path
 * @returns The value at that path, or undefined if not found
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
