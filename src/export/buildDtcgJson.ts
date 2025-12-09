/**
 * Builds DTCG-compliant JSON export of all local variables from a Figma file.
 *
 * This module handles the extraction and transformation of Figma's variable
 * data into DTCG (Design Tokens Community Group) format per the specification:
 * https://www.designtokens.org/tr/2025.10/
 *
 * Key features:
 * - Converts Figma variables to DTCG nested group structure
 * - Uses Option C mode handling: all modes in $extensions, primary mode in $value
 * - Supports color (sRGB hex), dimension, number, string, boolean, and fontFamily types
 * - Handles alias references in DTCG format: {path.to.token}
 * - Generates deterministic output for version control
 */

import type { DtcgRoot, DtcgToken, DtcgTokenValue } from '../shared/dtcg-types';
import {
  buildTokenPath,
  convertValue,
  mapFigmaTypeToDtcg,
  setNestedValue,
  type VariablePathMap,
} from '../util/dtcgUtils';
import { stableStringify } from '../util/stableStringify';
import { sha256 } from './hash';
import { normalizeModeValue } from './valueNormalization';

/** Plugin version - can be replaced during build via define if desired */
const PLUGIN_VERSION = '0.2.0';

/**
 * Minimal shape for a collection mode to avoid implicit any.
 */
interface CollectionModeLite {
  modeId: string;
  name: string;
}

/**
 * Builds a DTCG-compliant variables export from the current Figma file.
 *
 * Process:
 * 1. Fetch all local variable collections and variables
 * 2. Build a variable ID → token path map (for alias resolution)
 * 3. For each variable:
 *    - Determine DTCG token type from Figma type
 *    - Convert primary mode value to $value
 *    - Store all mode values in `$extensions.modes`
 *    - Handle aliases using DTCG reference format
 * 4. Organize tokens into nested groups based on token paths
 * 5. Generate metadata and content hash
 *
 * @param figmaApi - Figma plugin API instance
 * @returns Promise resolving to DTCG-compliant export structure
 * @throws Error if variable extraction fails
 */
export async function buildDtcgJson(figmaApi: PluginAPI): Promise<DtcgRoot> {
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const allVars = await figma.variables.getLocalVariablesAsync();
    const fileName = figmaApi.root.name;

    // Phase 1: Build variable ID → token path map for alias resolution
    const variablePathMap: VariablePathMap = new Map();

    for (const variable of allVars) {
      const collection = collections.find((c) => c.id === variable.variableCollectionId);
      if (!collection) continue;

      const tokenPath = buildTokenPath(collection.name, variable.name);
      variablePathMap.set(variable.id, tokenPath);
    }

    // Phase 1b: Scan for any remote/library variable references and add them to the map
    const remoteVariableIds = new Set<string>();
    for (const variable of allVars) {
      for (const modeId in variable.valuesByMode) {
        const modeValue = variable.valuesByMode[modeId];
        const normalized = normalizeModeValue(modeValue);
        if (normalized.type === 'ALIAS' && normalized.refVariableId) {
          if (!variablePathMap.has(normalized.refVariableId)) {
            remoteVariableIds.add(normalized.refVariableId);
          }
        }
      }
    }

    // Fetch remote variables and add them to the path map
    for (const remoteId of remoteVariableIds) {
      try {
        const remoteVar = await figma.variables.getVariableByIdAsync(remoteId);
        if (remoteVar) {
          // Use a special prefix for remote variables to indicate they're external
          const remotePath = `external.${remoteVar.name.replace(/\s+/g, '-').toLowerCase()}`;
          variablePathMap.set(remoteVar.id, remotePath);
        }
      } catch {
        // If we can't fetch the remote variable, create a fallback reference
        variablePathMap.set(remoteId, `external.unknown-${remoteId.slice(0, 8)}`);
      }
    }

    // Phase 2: Build DTCG token structure
    const tokens: Record<string, unknown> = {};

    for (const variable of allVars) {
      const collection = collections.find((c) => c.id === variable.variableCollectionId);
      if (!collection) continue;

      const tokenPath = variablePathMap.get(variable.id);
      if (!tokenPath) continue;

      // Determine DTCG token type using the full token path for better heuristics
      const dtcgType = mapFigmaTypeToDtcg(variable.resolvedType, tokenPath);

      // Get collection modes
      const modes = collection.modes as readonly CollectionModeLite[];
      const primaryModeId = modes[0]?.modeId;

      // Convert primary mode value
      const primaryModeValue = variable.valuesByMode[primaryModeId];
      if (!primaryModeValue) continue;

      const normalizedPrimaryValue = normalizeModeValue(primaryModeValue);
      const primaryValue = convertValue(
        normalizedPrimaryValue,
        variable.resolvedType,
        tokenPath,
        variablePathMap
      );

      // Build DTCG token object
      const token: DtcgToken = {
        $value: primaryValue,
        $type: dtcgType,
      };

      // Add description if available (from scopes or codeSyntax)
      if (variable.description && variable.description.trim()) {
        token.$description = variable.description.trim();
      }

      // Option C: Store all modes in $extensions
      const modeValues: Record<string, DtcgTokenValue> = {};

      for (const mode of modes) {
        const modeValue = variable.valuesByMode[mode.modeId];
        if (!modeValue) continue;

        const normalizedModeValue = normalizeModeValue(modeValue);

        modeValues[mode.name] = convertValue(
          normalizedModeValue,
          variable.resolvedType,
          tokenPath,
          variablePathMap
        );
      }

      // Add extension data
      token.$extensions = {
        'com.figma': {
          modes: modeValues,
          scopes: variable.scopes || [],
          codeSyntax: variable.codeSyntax || {},
          hiddenFromPublishing: variable.hiddenFromPublishing || false,
        },
      };

      // Set token in nested structure
      setNestedValue(tokens, tokenPath, token);
    }

    // Phase 3: Build metadata
    const variablesCount = allVars.length;
    const collectionsCount = collections.length;

    // Create root structure with metadata
    const root: DtcgRoot = {
      ...tokens,
      $extensions: {
        'com.figma': {
          exportedAt: new Date().toISOString(),
          fileName,
          pluginVersion: PLUGIN_VERSION,
          collectionsCount,
          variablesCount,
          contentHash: '', // Will be set below
        },
      },
    };

    // Phase 4: Calculate content hash
    // Hash only the token data (exclude volatile metadata like exportedAt)
    const stableContent = { ...tokens };
    const json = stableStringify(stableContent, 2);
    const contentHash = await sha256(json);

    // Update hash in metadata
    if (root.$extensions && root.$extensions['com.figma']) {
      (root.$extensions['com.figma'] as Record<string, unknown>).contentHash = contentHash;
    }

    return root;
  } catch (error) {
    throw new Error(
      `Failed to build DTCG JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
