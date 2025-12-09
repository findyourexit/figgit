import type { DtcgRoot } from '../shared/dtcg-types';
import type { FigmaNativeExportDocument } from '../shared/figma-native-types';

export type ExportFormat = 'dtcg' | 'figma-native';
export type ExportType = 'singleFile' | 'perCollection';

export interface ExportDocument<T = unknown> {
  id: string;
  label: string;
  format: ExportFormat;
  exportType: ExportType;
  relativePath: string;
  fileName: string;
  data: T;
  contentHash: string;
  variablesCount: number;
  collectionsCount: number;
  collectionId?: string;
  collectionName?: string;
}

export interface ExportSummary {
  format: ExportFormat;
  exportType: ExportType;
  exportedAt: string;
  pluginVersion: string;
  fileName: string;
  variablesCount: number;
  collectionsCount: number;
  documentsCount: number;
  contentHash: string;
}

export interface ExportBundle {
  summary: ExportSummary;
  documents: ExportDocument[];
}

export type ExportDocumentData = DtcgRoot | FigmaNativeExportDocument | Record<string, unknown>;
