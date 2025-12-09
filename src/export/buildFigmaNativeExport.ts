/**
 * Builds the "figma-native" export bundle.
 *
 * The output mirrors Figma's Variables UI hierarchy, including
 * collections, nested groups, mode metadata, and per-variable paths.
 * Every document embeds deterministic metadata and hashes so Git diffs
 * remain stable even when exporting one file per collection.
 */
import { PLUGIN_VERSION } from '../constants';
import { stableStringify } from '../util/stableStringify';
import { sha256 } from './hash';
import { normalizeModeValue } from './valueNormalization';
import { rgbToHex } from '../util/colorUtils';
import { slugify } from '../util/slugify';
import { buildRepoPath } from '../util/path';
import type { ExportBundle, ExportDocument, ExportSummary, ExportType } from '../types/export';
import type {
  FigmaNativeExportDocument,
  FigmaNativeCollection,
  FigmaNativeGroup,
  FigmaNativeVariable,
  ValueByModeEntry,
} from '../shared/figma-native-types';
import type { VariableModeValue } from '../util/dtcgUtils';

interface BuildNativeOptions {
  exportType: ExportType;
  folder?: string;
  singleFileName: string;
}

export async function buildFigmaNativeExport(
  figmaApi: PluginAPI,
  options: BuildNativeOptions
): Promise<ExportBundle> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVariables = await figma.variables.getLocalVariablesAsync();

  const fileName = figmaApi.root.name;
  const exportedAt = new Date().toISOString();
  const totalVariables = allVariables.length;
  const totalCollections = collections.length;

  const variablesById = new Map(allVariables.map((variable) => [variable.id, variable]));
  const aliasSources = buildAliasSources(allVariables);
  const remoteVariableNames = await resolveRemoteVariableNames(allVariables, variablesById);

  const sanitizedSingleFileName = ensureJsonExtension(options.singleFileName || 'variables.json');

  const documents: ExportDocument[] = [];

  if (options.exportType === 'singleFile') {
    const documentData = await buildDocumentData({
      collections,
      variables: allVariables,
      fileName,
      exportedAt,
      exportType: 'singleFile',
      variablesById,
      aliasSources,
      remoteVariableNames,
      pluginVersion: PLUGIN_VERSION,
    });

    const relativePath = buildRepoPath(options.folder, sanitizedSingleFileName);
    documents.push({
      id: 'figma-native:all',
      label: 'All Collections',
      format: 'figma-native',
      exportType: 'singleFile',
      relativePath,
      fileName: sanitizedSingleFileName,
      data: documentData,
      contentHash: documentData.contentHash,
      variablesCount: documentData.variablesCount,
      collectionsCount: documentData.collectionsCount,
    });
  } else {
    const slugUsage = new Map<string, number>();

    for (const collection of collections) {
      const collectionVariables = allVariables.filter(
        (variable) => variable.variableCollectionId === collection.id
      );

      const documentData = await buildDocumentData({
        collections: [collection],
        variables: collectionVariables,
        fileName,
        exportedAt,
        exportType: 'perCollection',
        variablesById,
        aliasSources,
        remoteVariableNames,
        pluginVersion: PLUGIN_VERSION,
        collectionContext: collection,
      });

      const slugBase = slugify(collection.name, `collection-${documents.length + 1}`);
      const occurrences = slugUsage.get(slugBase) ?? 0;
      slugUsage.set(slugBase, occurrences + 1);
      const slug = occurrences === 0 ? slugBase : `${slugBase}-${occurrences + 1}`;
      const fileNameForCollection = `${slug}.json`;
      const relativePath = buildRepoPath(options.folder, fileNameForCollection);

      documents.push({
        id: `figma-native:${collection.id}`,
        label: collection.name,
        format: 'figma-native',
        exportType: 'perCollection',
        relativePath,
        fileName: fileNameForCollection,
        data: documentData,
        contentHash: documentData.contentHash,
        variablesCount: documentData.variablesCount,
        collectionsCount: documentData.collectionsCount,
        collectionId: collection.id,
        collectionName: collection.name,
      });
    }
  }

  const summaryHash = await sha256(
    stableStringify(
      documents
        .map((doc) => ({ path: doc.relativePath, hash: doc.contentHash }))
        .sort((a, b) => a.path.localeCompare(b.path))
    )
  );

  const summary: ExportSummary = {
    format: 'figma-native',
    exportType: options.exportType,
    exportedAt,
    pluginVersion: PLUGIN_VERSION,
    fileName,
    variablesCount: totalVariables,
    collectionsCount: totalCollections,
    documentsCount: documents.length,
    contentHash: summaryHash,
  };

  return { summary, documents };
}

interface DocumentBuildParams {
  collections: readonly VariableCollection[];
  variables: readonly Variable[];
  fileName: string;
  exportedAt: string;
  exportType: ExportType;
  variablesById: Map<string, Variable>;
  aliasSources: Map<string, string[]>;
  remoteVariableNames: Map<string, string>;
  pluginVersion: string;
  collectionContext?: VariableCollection;
}

async function buildDocumentData(params: DocumentBuildParams): Promise<FigmaNativeExportDocument> {
  const {
    collections,
    variables,
    fileName,
    exportedAt,
    exportType,
    variablesById,
    aliasSources,
    remoteVariableNames,
    pluginVersion,
    collectionContext,
  } = params;

  const collectionPayloads: FigmaNativeCollection[] = [];

  for (const collection of collections) {
    const scopedVariables = variables.filter(
      (variable) => variable.variableCollectionId === collection.id
    );
    collectionPayloads.push(
      buildCollectionPayload({
        collection,
        variables: scopedVariables,
        variablesById,
        aliasSources,
        remoteVariableNames,
      })
    );
  }

  const variablesCount = variables.length;
  const collectionsCount = collectionPayloads.length;

  const document: FigmaNativeExportDocument = {
    collectionsCount,
    variablesCount,
    contentHash: '',
    exportedAt,
    fileName,
    pluginVersion,
    exportFormat: 'figma-native',
    exportType,
    collectionId: collectionContext?.id,
    collectionName: collectionContext?.name,
    collections: collectionPayloads,
  };

  const hashInput = stableStringify({
    ...document,
    contentHash: undefined,
    exportedAt: undefined,
  });
  document.contentHash = await sha256(hashInput);

  return document;
}

interface CollectionPayloadParams {
  collection: VariableCollection;
  variables: readonly Variable[];
  variablesById: Map<string, Variable>;
  aliasSources: Map<string, string[]>;
  remoteVariableNames: Map<string, string>;
}

function buildCollectionPayload(params: CollectionPayloadParams): FigmaNativeCollection {
  const { collection, variables, variablesById, aliasSources, remoteVariableNames } = params;

  const rootVariables: FigmaNativeVariable[] = [];
  const rootGroups: MutableGroup[] = [];

  for (const variable of variables) {
    const nameSegments = getVariableSegments(variable.name);
    const variableNode = buildVariableNode(
      variable,
      collection,
      {
        variablesById,
        aliasSources,
        remoteVariableNames,
      },
      nameSegments
    );

    const groupSegments = nameSegments.slice(0, nameSegments.length - 1);

    if (groupSegments.length === 0) {
      rootVariables.push(variableNode);
    } else {
      insertIntoGroups(rootGroups, groupSegments, collection, variableNode);
    }
  }

  const sortedGroups = sortGroups(rootGroups);
  const groupedVariables = flattenGroupVariables(sortedGroups);
  const sortedVariables = [...rootVariables, ...groupedVariables].sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  return {
    id: collection.id,
    name: collection.name,
    description: (collection as { description?: string }).description,
    modes: collection.modes.map((mode) => ({
      id: mode.modeId,
      name: mode.name,
      description: (mode as { description?: string }).description,
    })),
    groups: sortedGroups,
    variables: sortedVariables,
    collectionVariablesCount: variables.length,
  };
}

interface BuildVariableContext {
  variablesById: Map<string, Variable>;
  aliasSources: Map<string, string[]>;
  remoteVariableNames: Map<string, string>;
}

function buildVariableNode(
  variable: Variable,
  collection: VariableCollection,
  context: BuildVariableContext,
  nameSegments: string[]
): FigmaNativeVariable {
  const type = mapVariableType(variable.resolvedType);
  const scopes = Array.isArray(variable.scopes) ? Array.from(new Set(variable.scopes)) : undefined;
  const codeSyntaxEntries = variable.codeSyntax
    ? Object.entries(variable.codeSyntax).map(([platform, value]) => ({ platform, value }))
    : [];
  const aliases = context.aliasSources.get(variable.id) || [];
  const normalizedSegments = nameSegments.length
    ? nameSegments
    : [variable.name]
        .map((segment) => segment.trim())
        .filter((segment): segment is string => Boolean(segment));
  const variableName = normalizedSegments.length
    ? normalizedSegments[normalizedSegments.length - 1]
    : variable.name.trim() || variable.name;
  const variablePath = normalizedSegments.length ? normalizedSegments.join('/') : variableName;

  const valueByMode: Record<string, ValueByModeEntry> = {};
  for (const mode of collection.modes) {
    const rawValue = variable.valuesByMode[mode.modeId];
    if (!rawValue) continue;

    const normalized = normalizeModeValue(rawValue);
    const entry = buildModeValueEntry(
      normalized,
      context.variablesById,
      context.remoteVariableNames
    );
    if (!entry) continue;
    valueByMode[mode.modeId] = entry;
  }

  const node: FigmaNativeVariable = {
    id: variable.id,
    name: variableName,
    path: variablePath,
    type,
    description: variable.description?.trim() || undefined,
    scopes,
    codeSyntax: codeSyntaxEntries.length ? codeSyntaxEntries : undefined,
    aliases: aliases.length
      ? aliases.map((aliasId) => context.variablesById.get(aliasId)?.name || aliasId).sort()
      : undefined,
    hiddenFromPublishing: variable.hiddenFromPublishing,
    valueByMode,
  };

  if (!node.hiddenFromPublishing) {
    delete node.hiddenFromPublishing;
  }

  return node;
}

function buildModeValueEntry(
  modeValue: VariableModeValue,
  variablesById: Map<string, Variable>,
  remoteVariableNames: Map<string, string>
): ValueByModeEntry | undefined {
  if (
    modeValue.type === 'COLOR' &&
    modeValue.value &&
    typeof modeValue.value === 'object' &&
    'r' in modeValue.value
  ) {
    const color = modeValue.value as { r: number; g: number; b: number; a: number };
    return { value: colorToString(color) };
  }

  if (modeValue.type === 'STRING' && typeof modeValue.value === 'string') {
    return { value: modeValue.value };
  }

  if (modeValue.type === 'NUMBER' && typeof modeValue.value === 'number') {
    return { value: modeValue.value };
  }

  if (modeValue.type === 'BOOLEAN' && typeof modeValue.value === 'boolean') {
    return { value: modeValue.value };
  }

  if (modeValue.type === 'ALIAS' && modeValue.refVariableId) {
    const referencedVariable = variablesById.get(modeValue.refVariableId);
    const referencedName =
      referencedVariable?.name || remoteVariableNames.get(modeValue.refVariableId);
    const value = referencedName || modeValue.refVariableId;
    return {
      value,
      referencedVariableId: modeValue.refVariableId,
      referencedVariableName: referencedName,
    };
  }

  return undefined;
}

function colorToString(color: { r: number; g: number; b: number; a: number }): string {
  const hex = rgbToHex(color.r, color.g, color.b);
  if (color.a === undefined || Math.abs(color.a - 1) < 0.0001) {
    return hex;
  }
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${Number(color.a.toFixed(3))})`;
}

interface MutableGroup extends FigmaNativeGroup {
  groups: MutableGroup[];
  variables: FigmaNativeVariable[];
}

function insertIntoGroups(
  groups: MutableGroup[],
  segments: string[],
  collection: VariableCollection,
  variable: FigmaNativeVariable
) {
  let currentGroups = groups;
  const pathSegments: string[] = [];
  let parent: MutableGroup | undefined;

  for (const segment of segments) {
    pathSegments.push(segment);
    let group = currentGroups.find((g) => g.name === segment);
    if (!group) {
      const path = `${collection.name}/${pathSegments.join('/')}`;
      group = {
        id: `${collection.id}:${pathSegments.join('/') || 'root'}`,
        name: segment,
        path,
        groups: [],
        variables: [],
      };
      currentGroups.push(group);
    }
    parent = group;
    currentGroups = group.groups;
  }

  parent?.variables.push(variable);
}

function sortGroups(groups: MutableGroup[]): FigmaNativeGroup[] {
  return groups
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((group) => ({
      id: group.id,
      name: group.name,
      path: group.path,
      groups: sortGroups(group.groups),
      variables: [...group.variables].sort((a, b) => a.path.localeCompare(b.path)),
    }));
}

function flattenGroupVariables(groups: FigmaNativeGroup[]): FigmaNativeVariable[] {
  const result: FigmaNativeVariable[] = [];
  for (const group of groups) {
    result.push(...group.variables);
    result.push(...flattenGroupVariables(group.groups));
  }
  return result;
}

function buildAliasSources(variables: readonly Variable[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const variable of variables) {
    for (const value of Object.values(variable.valuesByMode)) {
      const normalized = normalizeModeValue(value);
      if (normalized.type === 'ALIAS' && normalized.refVariableId) {
        const arr = map.get(normalized.refVariableId) ?? [];
        arr.push(variable.id);
        map.set(normalized.refVariableId, arr);
      }
    }
  }
  return map;
}

async function resolveRemoteVariableNames(
  variables: readonly Variable[],
  variablesById: Map<string, Variable>
): Promise<Map<string, string>> {
  const remoteIds = new Set<string>();
  for (const variable of variables) {
    for (const value of Object.values(variable.valuesByMode)) {
      const normalized = normalizeModeValue(value);
      if (normalized.type === 'ALIAS' && normalized.refVariableId) {
        if (!variablesById.has(normalized.refVariableId)) {
          remoteIds.add(normalized.refVariableId);
        }
      }
    }
  }

  const map = new Map<string, string>();
  for (const id of remoteIds) {
    try {
      const remote = await figma.variables.getVariableByIdAsync(id);
      if (remote) {
        map.set(id, remote.name);
      }
    } catch {
      // Ignore failures
    }
  }
  return map;
}

function mapVariableType(resolvedType: string): FigmaNativeVariable['type'] {
  switch (resolvedType) {
    case 'COLOR':
      return 'color';
    case 'BOOLEAN':
      return 'boolean';
    case 'STRING':
      return 'string';
    default:
      return 'number';
  }
}

function ensureJsonExtension(name: string): string {
  if (!name) return 'variables.json';
  return name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
}

function getVariableSegments(name: string): string[] {
  return name
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment): segment is string => Boolean(segment));
}
