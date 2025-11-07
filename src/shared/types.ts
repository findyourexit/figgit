/**
 * Shared Type Definitions
 *
 * Core data structures used throughout the Figgit plugin for representing
 * Figma variables and their export formats. These types are shared between
 * the plugin runtime and UI code.
 */

/**
 * Represents a single value for a variable in a specific mode.
 *
 * A mode value can be either a concrete value (color, string, number, boolean)
 * or an alias reference to another variable.
 */
export interface VariableModeValue {
  /** The data type of this value */
  type: 'COLOR' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ALIAS';

  /**
   * The actual value when type is not ALIAS.
   * - For COLOR: RGB object like { r: 0.5, g: 0.5, b: 0.5, a: 1 }
   * - For STRING: string value
   * - For NUMBER: numeric value
   * - For BOOLEAN: boolean value
   * - For ALIAS: undefined (use refVariableId instead)
   */
  value?: string | number | boolean | { r: number; g: number; b: number; a: number };

  /**
   * Variable ID being referenced when type is ALIAS.
   * Points to another ExportedVariable's id property.
   */
  refVariableId?: string;
}

/**
 * Represents a single exported Figma variable with all its properties.
 *
 * Each variable can have different values per mode (like light/dark themes)
 * and can either contain concrete values or reference other variables via aliases.
 */
export interface ExportedVariable {
  /** Unique Figma variable ID */
  id: string;

  /** Human-readable variable name (e.g., "color/primary/500") */
  name: string;

  /** Resolved type after following any alias chain */
  resolvedType: string;

  /** True if this variable references another variable (all modes are aliases) */
  isAlias: boolean;

  /**
   * Scopes where this variable can be applied in Figma.
   * Examples: ["ALL_SCOPES"], ["FRAME_FILL", "SHAPE_FILL"], etc.
   */
  scopes: string[];

  /**
   * Map of mode ID to the variable's value in that mode.
   * Each collection can have multiple modes (e.g., "Light", "Dark").
   */
  valuesByMode: Record<string, VariableModeValue>;

  /**
   * Optional code generation snippets for different platforms.
   * Example: { "WEB": "var(--color-primary-500)", "ANDROID": "@color/primary_500" }
   */
  codeSyntax?: Record<string, string>;
}

/**
 * Represents a Figma variable collection containing related variables.
 *
 * Collections group variables together and define the modes (variants)
 * that all variables in the collection can have values for.
 */
export interface ExportedCollection {
  /** Unique Figma collection ID */
  id: string;

  /** Human-readable collection name */
  name: string;

  /**
   * Available modes for this collection.
   * All variables in the collection have values for each mode.
   * Example: [{ id: "1:0", name: "Light" }, { id: "1:1", name: "Dark" }]
   */
  modes: { id: string; name: string }[];

  /** All variables belonging to this collection */
  variables: ExportedVariable[];
}

/**
 * Root export format containing all collections and metadata.
 *
 * This is the legacy export format. The plugin also supports DTCG
 * (Design Tokens Community Group) format via the DtcgRoot type.
 */
export interface ExportRoot {
  /** Metadata about the export operation and source file */
  meta: {
    /** ISO timestamp of when the export was generated */
    exportedAt: string;

    /** Target filename for the exported JSON */
    fileName: string;

    /** Figgit plugin version that generated this export */
    pluginVersion: string;

    /** Figma file ID where these variables came from */
    figmaFileId: string;

    /** Total number of collections exported */
    collectionsCount: number;

    /** Total number of variables exported across all collections */
    variablesCount: number;

    /**
     * SHA-256 hash of the normalized export content.
     * Used to skip commits when content hasn't changed.
     */
    contentHash?: string;
  };

  /** All exported variable collections */
  collections: ExportedCollection[];
}
