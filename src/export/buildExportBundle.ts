/**
 * Central export orchestrator.
 *
 * Chooses the correct builder (DTCG vs Figma-native) according to the
 * current plugin settings and always returns a normalized ExportBundle
 * so downstream code can render previews, diffs, and commits without
 * format-specific branching.
 */
import { buildDtcgJson } from './buildDtcgJson';
import { buildFigmaNativeExport } from './buildFigmaNativeExport';
import { buildRepoPath } from '../util/path';
import { stableStringify } from '../util/stableStringify';
import { sha256 } from './hash';
import { PLUGIN_VERSION } from '../constants';
import type { ExportBundle, ExportDocument, ExportSummary } from '../types/export';
import type { PersistedSettings } from '../messaging';
import type { DtcgRoot, DtcgFigmaExtensions } from '../shared/dtcg-types';

export async function buildExportBundle(
  figmaApi: PluginAPI,
  settings: PersistedSettings
): Promise<ExportBundle> {
  const format = settings.exportFormat || 'dtcg';
  const exportType = format === 'dtcg' ? 'singleFile' : settings.exportType || 'singleFile';

  if (format === 'figma-native') {
    return buildFigmaNativeExport(figmaApi, {
      exportType,
      folder: settings.folder,
      singleFileName: settings.filename || 'variables.json',
    });
  }

  return buildDtcgBundle(figmaApi, settings);
}

async function buildDtcgBundle(
  figmaApi: PluginAPI,
  settings: PersistedSettings
): Promise<ExportBundle> {
  const root = (await buildDtcgJson(figmaApi)) as DtcgRoot;
  const figmaExt = (root.$extensions?.['com.figma'] as DtcgFigmaExtensions | undefined) || {};

  const exportedAt =
    typeof figmaExt.exportedAt === 'string' ? figmaExt.exportedAt : new Date().toISOString();
  const pluginVersion = figmaExt.pluginVersion || PLUGIN_VERSION;
  const fileName = figmaExt.fileName || figmaApi.root.name;
  const variablesCount = figmaExt.variablesCount ?? 0;
  const collectionsCount = figmaExt.collectionsCount ?? 0;

  let contentHash = figmaExt.contentHash;
  if (!contentHash) {
    const tokensOnly = { ...root };
    delete tokensOnly.$extensions;
    contentHash = await sha256(stableStringify(tokensOnly));
  }

  const fileNameSetting = settings.filename || 'variables.json';
  const relativePath = buildRepoPath(settings.folder, fileNameSetting);

  const document: ExportDocument<DtcgRoot> = {
    id: 'dtcg:all',
    label: 'All Collections (DTCG)',
    format: 'dtcg',
    exportType: 'singleFile',
    relativePath,
    fileName: fileNameSetting,
    data: root,
    contentHash,
    variablesCount,
    collectionsCount,
  };

  const summary: ExportSummary = {
    format: 'dtcg',
    exportType: 'singleFile',
    exportedAt,
    pluginVersion,
    fileName,
    variablesCount,
    collectionsCount,
    documentsCount: 1,
    contentHash,
  };

  return { summary, documents: [document] };
}
