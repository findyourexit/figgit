export interface VariableModeValue {
  type: 'COLOR' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ALIAS';
  value?: any; // primitive or color object
  refVariableId?: string; // when alias
}

export interface ExportedVariable {
  id: string;
  name: string;
  resolvedType: string;
  isAlias: boolean;
  scopes: string[];
  valuesByMode: Record<string, VariableModeValue>;
  codeSyntax?: Record<string, string>;
}

export interface ExportedCollection {
  id: string;
  name: string;
  modes: { id: string; name: string }[];
  variables: ExportedVariable[];
}

export interface ExportRoot {
  meta: {
    exportedAt: string;
    fileName: string;
    pluginVersion: string;
    figmaFileId: string;
    collectionsCount: number;
    variablesCount: number;
    contentHash?: string; // sha256 for commit skip
  };
  collections: ExportedCollection[];
}
