export type NativeExportType = 'singleFile' | 'perCollection';

export interface FigmaNativeMode {
  id: string;
  name: string;
  description?: string;
}

export interface CodeSyntaxEntry {
  platform: string;
  value: string;
}

export interface ValueByModeEntry {
  value: string | number | boolean;
  referencedVariableId?: string;
  referencedVariableName?: string;
}

export interface FigmaNativeVariable {
  id: string;
  name: string;
  path: string;
  type: 'color' | 'number' | 'string' | 'boolean';
  description?: string;
  scopes?: string[];
  codeSyntax?: CodeSyntaxEntry[];
  aliases?: string[];
  hiddenFromPublishing?: boolean;
  valueByMode: Record<string, ValueByModeEntry>;
}

export interface FigmaNativeGroup {
  id: string;
  name: string;
  path: string;
  groups: FigmaNativeGroup[];
  variables: FigmaNativeVariable[];
}

export interface FigmaNativeCollection {
  id: string;
  name: string;
  description?: string;
  modes: FigmaNativeMode[];
  groups: FigmaNativeGroup[];
  variables: FigmaNativeVariable[];
  collectionVariablesCount: number;
}

export interface FigmaNativeExportDocument {
  collectionsCount: number;
  variablesCount: number;
  contentHash: string;
  exportedAt: string;
  fileName: string;
  pluginVersion: string;
  exportFormat: 'figma-native';
  exportType: NativeExportType;
  collectionId?: string;
  collectionName?: string;
  collections: FigmaNativeCollection[];
}
