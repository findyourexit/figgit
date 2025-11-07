/**
 * DTCG (Design Tokens Community Group) Type Definitions
 *
 * This module defines TypeScript interfaces for the DTCG specification v2025.10.
 * Reference: https://www.designtokens.org/tr/2025.10/
 *
 * DTCG is a standard format for exchanging design tokens between tools.
 * Key concepts:
 * - Tokens: Objects with $value property
 * - Groups: Objects without $value (organize tokens)
 * - Types: color, dimension, number, string, boolean, fontFamily, fontWeight, duration, etc.
 * - Extensions: Tool-specific metadata in $extensions
 */

/**
 * DTCG Color Value
 *
 * Represents a color in the sRGB color space.
 * All component values are in the range [0, 1].
 */
export interface DtcgColorValue {
  colorSpace: 'srgb';
  components: [number, number, number]; // [r, g, b] in range [0, 1]
  alpha: number; // Alpha/opacity in range [0, 1]
  hex: string; // Hex color code (e.g., "#ff0066")
}

/**
 * DTCG Dimension Value
 *
 * Represents a measurement with a unit.
 * Supported units: "px" (pixels), "rem" (root em)
 */
export interface DtcgDimensionValue {
  value: number; // Numeric value (can be integer or float)
  unit: 'px' | 'rem';
}

/**
 * DTCG Duration Value
 *
 * Represents a time duration.
 * Supported units: "ms" (milliseconds), "s" (seconds)
 */
export interface DtcgDurationValue {
  value: number; // Numeric value (can be integer or float)
  unit: 'ms' | 's';
}

/**
 * DTCG Cubic Bezier Value
 *
 * Represents an animation easing curve.
 * Format: [P1x, P1y, P2x, P2y]
 * P1 and P2 are control points with x in [0, 1] and y in [-∞, ∞]
 */
export type DtcgCubicBezierValue = [number, number, number, number];

/**
 * DTCG Font Weight Value
 *
 * Can be a number (100-1000) or a keyword string.
 */
export type DtcgFontWeightValue =
  | number // 100-1000
  | 'thin'
  | 'hairline'
  | 'extra-light'
  | 'ultra-light'
  | 'light'
  | 'normal'
  | 'regular'
  | 'book'
  | 'medium'
  | 'semi-bold'
  | 'demi-bold'
  | 'bold'
  | 'extra-bold'
  | 'ultra-bold'
  | 'black'
  | 'heavy'
  | 'extra-black'
  | 'ultra-black';

/**
 * DTCG Token Type
 *
 * All supported DTCG token types.
 */
export type DtcgTokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'string'
  | 'boolean';

/**
 * DTCG Token Value
 *
 * The value of a token can be:
 * - A type-specific value (color object, dimension object, primitive, etc.)
 * - A reference to another token (string in format "{group.token}")
 */
export type DtcgTokenValue =
  | DtcgColorValue
  | DtcgDimensionValue
  | DtcgDurationValue
  | DtcgCubicBezierValue
  | DtcgFontWeightValue
  | string // string type or reference
  | string[] // fontFamily array
  | number // number type
  | boolean; // boolean type

/**
 * Figma-Specific Extensions
 *
 * Metadata preserved from Figma in the $extensions.com.figma object.
 */
export interface DtcgFigmaExtensions {
  /** Figma variable ID */
  id?: string;

  /** Figma collection ID */
  collectionId?: string;

  /** Figma collection name */
  collectionName?: string;

  /** Variable scopes (e.g., ["ALL_SCOPES"]) */
  scopes?: string[];

  /** Figma's resolved type (e.g., "COLOR", "FLOAT") */
  resolvedType?: string;

  /** All mode values (mode name -> value) */
  modes?: Record<string, DtcgTokenValue>;

  /** Name of the default/primary mode */
  defaultMode?: string;

  /** Code syntax settings (if any) */
  codeSyntax?: Record<string, string>;

  /** Export metadata (root-level only) */
  exportedAt?: string;
  fileName?: string;
  pluginVersion?: string;
  figmaFileId?: string;
  contentHash?: string;
  collectionsCount?: number;
  variablesCount?: number;

  /** Variable visibility (token-level only) */
  hiddenFromPublishing?: boolean;
}

/**
 * DTCG Token
 *
 * A design token with a value and optional metadata.
 */
export interface DtcgToken {
  /** The token's value (REQUIRED) */
  $value: DtcgTokenValue;

  /** The token's type (can be inherited from group) */
  $type?: DtcgTokenType;

  /** Human-readable description */
  $description?: string;

  /** Tool-specific extensions */
  $extensions?: {
    'com.figma'?: DtcgFigmaExtensions;
    [vendor: string]: unknown;
  };

  /** Deprecation status */
  $deprecated?: boolean | string;
}

/**
 * DTCG Group
 *
 * A container for organizing tokens.
 * Groups can contain tokens and/or nested groups.
 */
export interface DtcgGroup {
  /** Type to inherit to child tokens/groups */
  $type?: DtcgTokenType;

  /** Description of this group */
  $description?: string;

  /** Tool-specific extensions */
  $extensions?: {
    'com.figma'?: Partial<DtcgFigmaExtensions>;
    [vendor: string]: unknown;
  };

  /** Deprecation status */
  $deprecated?: boolean | string;

  /** Child tokens or groups (not prefixed with $) */
  [tokenOrGroupName: string]: unknown;
}

/**
 * DTCG Root
 *
 * The root object of a DTCG tokens file.
 * Can contain tokens and/or groups.
 */
export type DtcgRoot = DtcgGroup;

/**
 * Type guard to check if an object is a DTCG token
 */
export function isDtcgToken(obj: unknown): obj is DtcgToken {
  return obj !== null && typeof obj === 'object' && '$value' in obj;
}

/**
 * Type guard to check if an object is a DTCG group
 */
export function isDtcgGroup(obj: unknown): obj is DtcgGroup {
  return obj !== null && typeof obj === 'object' && !('$value' in obj);
}

/**
 * Type guard to check if a value is a DTCG color
 */
export function isDtcgColorValue(value: unknown): value is DtcgColorValue {
  return (
    value !== null &&
    typeof value === 'object' &&
    'colorSpace' in value &&
    value.colorSpace === 'srgb' &&
    'components' in value &&
    Array.isArray(value.components) &&
    value.components.length === 3 &&
    'alpha' in value &&
    typeof value.alpha === 'number' &&
    'hex' in value &&
    typeof value.hex === 'string'
  );
}

/**
 * Type guard to check if a value is a DTCG dimension
 */
export function isDtcgDimensionValue(value: unknown): value is DtcgDimensionValue {
  return (
    value !== null &&
    typeof value === 'object' &&
    'value' in value &&
    typeof value.value === 'number' &&
    'unit' in value &&
    (value.unit === 'px' || value.unit === 'rem')
  );
}

/**
 * Type guard to check if a value is a reference/alias
 */
export function isDtcgReference(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('{') && value.endsWith('}');
}
