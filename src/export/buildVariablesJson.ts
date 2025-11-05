/**
 * Builds a complete JSON export of all local variables from a Figma file.
 *
 * This module handles the extraction and transformation of Figma's variable
 * data into a structured, deterministic JSON format suitable for version control.
 *
 * Key features:
 * - Extracts all local variables and collections
 * - Normalizes variable values (colors, numbers, strings, booleans, aliases)
 * - Sorts collections and variables alphabetically for determinism
 * - Generates a content hash for change detection
 * - Includes metadata (export time, file info, counts)
 */

import {
  ExportedCollection,
  ExportedVariable,
  ExportRoot,
  VariableModeValue,
} from '../shared/types';
import { stableStringify } from '../util/stableStringify';
import { sha256 } from './hash';

/** Plugin version - can be replaced during build via define if desired */
const PLUGIN_VERSION = '0.1.0';

/**
 * Minimal shape for a collection mode to avoid implicit any.
 * We only need the essential fields for export.
 */
interface CollectionModeLite {
  modeId: string;
  name: string;
}

/**
 * Builds a complete variables export from the current Figma file.
 *
 * Process:
 * 1. Fetch all local variable collections and variables
 * 2. Group variables by collection
 * 3. Normalize variable values (colors, primitives, aliases)
 * 4. Sort collections and variables alphabetically
 * 5. Generate metadata (counts, file info, export time)
 * 6. Calculate content hash for change detection
 *
 * @param figmaApi - Figma plugin API instance
 * @returns Promise resolving to complete export data structure
 * @throws Error if variable extraction fails
 */
export async function buildVariablesJson(figmaApi: PluginAPI): Promise<ExportRoot> {
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const allVars = await figma.variables.getLocalVariablesAsync();
    const fileName = figmaApi.root.name;
    const fileId = figmaApi.root.id;

    // Group variables by collection ID
    const byCollection: Record<string, ExportedCollection> = {};

    // Initialize collection objects
    for (const c of collections) {
      byCollection[c.id] = {
        id: c.id,
        name: c.name,
        modes: (c.modes as readonly CollectionModeLite[]).map((m) => ({
          id: m.modeId,
          name: m.name,
        })),
        variables: [],
      };
    }

    // Process each variable and add to its collection
    for (const v of allVars) {
      const col = byCollection[v.variableCollectionId];
      if (!col) continue; // Should not happen - variable without collection

      // Normalize values for each mode
      const valuesByMode: Record<string, VariableModeValue> = {};
      for (const modeId of Object.keys(v.valuesByMode)) {
        const raw = v.valuesByMode[modeId];
        valuesByMode[modeId] = normalizeModeValue(raw);
      }

      // Build exported variable object
      const exported: ExportedVariable = {
        id: v.id,
        name: v.name,
        resolvedType: v.resolvedType,
        isAlias: Object.values(valuesByMode).some((m) => m.type === 'ALIAS'),
        scopes: (v.scopes || []) as string[],
        valuesByMode,
        codeSyntax: v.codeSyntax || undefined,
      };
      col.variables.push(exported);
    }

    // Sort collections and variables alphabetically for determinism
    const sortedCollections = Object.values(byCollection)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        ...c,
        variables: c.variables.sort((a, b) => a.name.localeCompare(b.name)),
      }));

    // Build root export structure with metadata
    const root: ExportRoot = {
      meta: {
        exportedAt: new Date().toISOString(),
        fileName,
        pluginVersion: PLUGIN_VERSION,
        figmaFileId: fileId,
        collectionsCount: sortedCollections.length,
        variablesCount: sortedCollections.reduce((sum, c) => sum + c.variables.length, 0),
        contentHash: '', // Will be set below
      },
      collections: sortedCollections,
    };

    // Calculate hash of stable content (exclude volatile fields like exportedAt)
    // This ensures the hash only changes when actual variable data changes
    const stableContent = {
      meta: {
        fileName,
        pluginVersion: PLUGIN_VERSION,
        figmaFileId: fileId,
        collectionsCount: root.meta.collectionsCount,
        variablesCount: root.meta.variablesCount,
      },
      collections: sortedCollections,
    };
    const json = stableStringify(stableContent, 2);
    root.meta.contentHash = await sha256(json);

    return root;
  } catch (error) {
    throw new Error(
      `Failed to build variables JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Normalizes a variable's mode value into our structured format.
 *
 * Figma's variable values can be:
 * - Colors (objects with r, g, b, a properties)
 * - Aliases (references to other variables)
 * - Primitives (strings, numbers, booleans)
 *
 * This function detects the type and returns a normalized object.
 *
 * @param raw - Raw value from Figma's variable API
 * @returns Normalized value with explicit type
 */
function normalizeModeValue(raw: any): VariableModeValue {
  if (!raw || typeof raw !== 'object') {
    // Primitives (string/number/boolean) or unexpected values
    return inferPrimitive(raw);
  }

  // Alias detection: Figma 2025 API uses { type: 'VARIABLE_ALIAS', id: '...' }
  if (raw.type === 'VARIABLE_ALIAS' && raw.id) {
    return { type: 'ALIAS', refVariableId: raw.id };
  }

  // Color detection: Figma colors have r, g, b properties (0-1 range)
  if (typeof raw.r === 'number' && typeof raw.g === 'number' && typeof raw.b === 'number') {
    return { type: 'COLOR', value: { r: raw.r, g: raw.g, b: raw.b, a: raw.a ?? 1 } };
  }

  // Fallback to primitive inference
  return inferPrimitive(raw);
}

/**
 * Infers the type of a primitive value and wraps it in our value format.
 *
 * @param val - Primitive value
 * @returns Typed value object
 */
function inferPrimitive(val: any): VariableModeValue {
  switch (typeof val) {
    case 'string':
      return { type: 'STRING', value: val };
    case 'number':
      return { type: 'NUMBER', value: val };
    case 'boolean':
      return { type: 'BOOLEAN', value: val };
    default:
      // Fallback: convert to string
      return { type: 'STRING', value: String(val) };
  }
}
