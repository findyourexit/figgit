import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildFigmaNativeExport } from '../src/export/buildFigmaNativeExport';
import type { ExportBundle } from '../src/types/export';
import type { FigmaNativeExportDocument } from '../src/shared/figma-native-types';

interface MockFigmaApi {
  root: { name: string };
  variables: {
    getLocalVariableCollectionsAsync: ReturnType<typeof vi.fn>;
    getLocalVariablesAsync: ReturnType<typeof vi.fn>;
    getVariableByIdAsync: ReturnType<typeof vi.fn>;
  };
}

const createMockFigma = (): MockFigmaApi => {
  const collections = [
    {
      id: 'collection-1',
      name: 'Global Colors',
      modes: [
        { modeId: 'mode-light', name: 'Light' },
        { modeId: 'mode-dark', name: 'Dark' },
      ],
    },
    {
      id: 'collection-2',
      name: 'Spacing',
      modes: [{ modeId: 'mode-default', name: 'Default' }],
    },
  ];

  const variables = [
    {
      id: 'var-color',
      name: 'Brand / Primary',
      variableCollectionId: 'collection-1',
      resolvedType: 'COLOR',
      valuesByMode: {
        'mode-light': { r: 1, g: 0, b: 0, a: 1 },
        'mode-dark': { r: 0.2, g: 0, b: 0, a: 1 },
      },
      description: 'Primary brand color',
      scopes: ['FILL'],
      codeSyntax: { WEB: 'brand-primary' },
      hiddenFromPublishing: false,
    },
    {
      id: 'var-spacing',
      name: 'Base',
      variableCollectionId: 'collection-2',
      resolvedType: 'FLOAT',
      valuesByMode: {
        'mode-default': 8,
      },
      description: 'Base spacing unit',
      scopes: ['ALL_SCOPES'],
      codeSyntax: {},
      hiddenFromPublishing: false,
    },
  ];

  return {
    root: { name: 'Mock File' },
    variables: {
      getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(collections),
      getLocalVariablesAsync: vi.fn().mockResolvedValue(variables),
      getVariableByIdAsync: vi.fn(),
    },
  };
};

describe('buildFigmaNativeExport', () => {
  let mockFigma: MockFigmaApi;

  beforeEach(() => {
    mockFigma = createMockFigma();
    (global as unknown as { figma: MockFigmaApi }).figma = mockFigma;
  });

  it('builds a single-file export bundle', async () => {
    const bundle = (await buildFigmaNativeExport(mockFigma as unknown as PluginAPI, {
      exportType: 'singleFile',
      folder: 'tokens',
      singleFileName: 'variables.json',
    })) as ExportBundle;

    expect(bundle.summary.format).toBe('figma-native');
    expect(bundle.summary.exportType).toBe('singleFile');
    expect(bundle.documents).toHaveLength(1);
    expect(bundle.documents[0].relativePath).toBe('tokens/variables.json');
    expect(bundle.documents[0].collectionsCount).toBe(2);
    expect(bundle.documents[0].variablesCount).toBe(2);

    const document = bundle.documents[0].data as FigmaNativeExportDocument;
    expect(document).toHaveProperty('collections');
    const firstCollection = document.collections[0];
    expect(firstCollection.variables[0].name).toBe('Primary');
    expect(firstCollection.variables[0].path).toBe('Brand/Primary');
    expect(firstCollection.variables[0].valueByMode['mode-light'].value).toBe('#ff0000');

    const spacingCollection = document.collections.find((col) => col.id === 'collection-2');
    expect(spacingCollection?.variables[0].name).toBe('Base');
    expect(spacingCollection?.variables[0].path).toBe('Base');
  });

  it('splits documents per collection when requested', async () => {
    const bundle = (await buildFigmaNativeExport(mockFigma as unknown as PluginAPI, {
      exportType: 'perCollection',
      folder: '',
      singleFileName: 'ignored.json',
    })) as ExportBundle;

    expect(bundle.summary.exportType).toBe('perCollection');
    expect(bundle.documents).toHaveLength(2);
    const paths = bundle.documents.map((doc) => doc.relativePath);
    expect(paths.some((path) => path.endsWith('global-colors.json'))).toBe(true);
    expect(paths.some((path) => path.endsWith('spacing.json'))).toBe(true);
  });

  it('includes metadata and hashes on each document', async () => {
    const bundle = (await buildFigmaNativeExport(mockFigma as unknown as PluginAPI, {
      exportType: 'singleFile',
      folder: '',
      singleFileName: 'variables.json',
    })) as ExportBundle;

    const document = bundle.documents[0].data as FigmaNativeExportDocument;
    expect(document.exportFormat).toBe('figma-native');
    expect(typeof document.contentHash).toBe('string');
    expect(document.contentHash).toHaveLength(64);
  });
});
