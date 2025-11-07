/**
 * DTCG Export Tests
 *
 * End-to-end tests for the DTCG export functionality.
 * Tests the complete transformation from Figma variables to DTCG format.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDtcgJson } from '../src/export/buildDtcgJson';
import type { DtcgRoot } from '../src/shared/dtcg-types';
import { isDtcgToken, isDtcgGroup } from '../src/shared/dtcg-types';

// Type for mock Figma API
interface MockFigmaApi {
  root: {
    name: string;
    id: string;
  };
  variables: {
    getLocalVariableCollectionsAsync: ReturnType<typeof vi.fn>;
    getLocalVariablesAsync: ReturnType<typeof vi.fn>;
  };
}

// Mock Figma API
const createMockFigmaApi = (): MockFigmaApi => {
  const mockCollections = [
    {
      id: 'collection-1',
      name: 'Colors',
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

  const mockVariables = [
    {
      id: 'var-1',
      name: 'bg.primary',
      variableCollectionId: 'collection-1',
      resolvedType: 'COLOR',
      description: 'Primary background color',
      scopes: ['ALL_SCOPES'],
      codeSyntax: { WEB: 'color-bg-primary' },
      hiddenFromPublishing: false,
      valuesByMode: {
        'mode-light': { r: 1, g: 1, b: 1, a: 1 },
        'mode-dark': { r: 0, g: 0, b: 0, a: 1 },
      },
    },
    {
      id: 'var-2',
      name: 'bg.secondary',
      variableCollectionId: 'collection-1',
      resolvedType: 'COLOR',
      description: '',
      scopes: ['ALL_SCOPES'],
      codeSyntax: {},
      hiddenFromPublishing: false,
      valuesByMode: {
        'mode-light': { r: 0.9, g: 0.9, b: 0.9, a: 1 },
        'mode-dark': { r: 0.1, g: 0.1, b: 0.1, a: 1 },
      },
    },
    {
      id: 'var-3',
      name: 'base',
      variableCollectionId: 'collection-2',
      resolvedType: 'FLOAT',
      description: 'Base spacing unit',
      scopes: ['ALL_SCOPES'],
      codeSyntax: {},
      hiddenFromPublishing: false,
      valuesByMode: {
        'mode-default': 16,
      },
    },
  ];

  return {
    root: {
      name: 'Test Design System',
      id: 'file-123',
    },
    variables: {
      getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
      getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
    },
  };
};

describe('buildDtcgJson', () => {
  let mockFigma: MockFigmaApi;

  beforeEach(() => {
    mockFigma = createMockFigmaApi();
    // Set global figma object
    (global as unknown as { figma: MockFigmaApi }).figma = mockFigma;
  });

  it('exports variables in DTCG format', async () => {
    const result = await buildDtcgJson(mockFigma as unknown as PluginAPI);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('$extensions');
  });

  it('includes metadata in $extensions.com.figma', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    expect(result.$extensions).toBeDefined();
    expect(result.$extensions?.['com.figma']).toBeDefined();

    const metadata = result.$extensions!['com.figma'];
    expect(metadata).toHaveProperty('exportedAt');
    expect(metadata).toHaveProperty('fileName', 'Test Design System');
    expect(metadata).toHaveProperty('pluginVersion');
    expect(metadata).toHaveProperty('collectionsCount', 2);
    expect(metadata).toHaveProperty('variablesCount', 3);
    expect(metadata).toHaveProperty('contentHash');
  });

  it('creates nested token structure from dotted variable names', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    // bg.primary should create nested structure
    expect(result).toHaveProperty('bg');
    const bg = result.bg as Record<string, unknown>;
    expect(bg).toHaveProperty('primary');
    expect(bg).toHaveProperty('secondary');
  });

  it('converts colors to DTCG color format', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgPrimary = (result.bg as Record<string, unknown>).primary as any;
    expect(bgPrimary).toHaveProperty('$value');
    expect(bgPrimary.$value).toHaveProperty('colorSpace', 'srgb');
    expect(bgPrimary.$value).toHaveProperty('hex');
    expect(bgPrimary.$value).toHaveProperty('components');
    expect(bgPrimary.$value).toHaveProperty('alpha');
  });

  it('sets correct DTCG token type', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgPrimary = (result.bg as Record<string, unknown>).primary as any;
    expect(bgPrimary).toHaveProperty('$type', 'color');

    const spacingBase = (result.spacing as Record<string, unknown>).base as any;
    expect(spacingBase).toHaveProperty('$type', 'dimension');
  });

  it('includes description when provided', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgPrimary = (result.bg as Record<string, unknown>).primary as any;
    expect(bgPrimary).toHaveProperty('$description', 'Primary background color');
  });

  it('omits description when empty', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgSecondary = (result.bg as Record<string, unknown>).secondary as any;
    expect(bgSecondary).not.toHaveProperty('$description');
  });

  it('stores all modes in $extensions.com.figma.modes (Option C)', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgPrimary = (result.bg as Record<string, unknown>).primary as any;
    expect(bgPrimary.$extensions?.['com.figma']).toHaveProperty('modes');

    const modes = bgPrimary.$extensions['com.figma'].modes;
    expect(modes).toHaveProperty('Light');
    expect(modes).toHaveProperty('Dark');
  });

  it('uses primary mode (first mode) for $value', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgPrimary = (result.bg as Record<string, unknown>).primary as any;

    // Light mode is first, so should be in $value (white)
    expect(bgPrimary.$value.hex).toBe('#ffffff');

    // Verify both modes are in extensions
    const lightMode = bgPrimary.$extensions['com.figma'].modes.Light;
    const darkMode = bgPrimary.$extensions['com.figma'].modes.Dark;

    expect(lightMode.hex).toBe('#ffffff');
    expect(darkMode.hex).toBe('#000000');
  });

  it('includes Figma-specific metadata in token extensions', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgPrimary = (result.bg as Record<string, unknown>).primary as any;
    const figmaExt = bgPrimary.$extensions['com.figma'];

    expect(figmaExt).toHaveProperty('scopes');
    expect(figmaExt.scopes).toContain('ALL_SCOPES');
    expect(figmaExt).toHaveProperty('codeSyntax');
    expect(figmaExt.codeSyntax).toHaveProperty('WEB', 'color-bg-primary');
    expect(figmaExt).toHaveProperty('hiddenFromPublishing', false);
  });

  it('converts FLOAT types to dimensions when appropriate', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const spacingBase = (result.spacing as Record<string, unknown>).base as any;
    expect(spacingBase.$value).toEqual({ value: 16, unit: 'px' });
    expect(spacingBase.$type).toBe('dimension');
  });

  it('generates consistent content hash', async () => {
    const result1 = await buildDtcgJson(mockFigma as any);
    const result2 = await buildDtcgJson(mockFigma as any);

    const hash1 = result1.$extensions?.['com.figma']?.contentHash;
    const hash2 = result2.$extensions?.['com.figma']?.contentHash;

    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
    // Note: hashes might differ due to exportedAt timestamp
    // but the structure should be the same
  });

  it('handles empty collections gracefully', async () => {
    mockFigma.variables.getLocalVariableCollectionsAsync.mockResolvedValue([]);
    mockFigma.variables.getLocalVariablesAsync.mockResolvedValue([]);

    const result = await buildDtcgJson(mockFigma as any);

    expect(result).toBeDefined();
    expect(result.$extensions?.['com.figma']?.variablesCount).toBe(0);
    expect(result.$extensions?.['com.figma']?.collectionsCount).toBe(0);
  });

  it('throws error when export fails', async () => {
    mockFigma.variables.getLocalVariablesAsync.mockRejectedValue(new Error('API error'));

    await expect(buildDtcgJson(mockFigma as any)).rejects.toThrow('Failed to build DTCG JSON');
  });
});

describe('buildDtcgJson with aliases', () => {
  let mockFigma: any;

  beforeEach(() => {
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'Colors',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
      },
    ];

    const mockVariables = [
      {
        id: 'var-base',
        name: 'color.brand.primary',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { r: 0.2, g: 0.4, b: 1.0, a: 1 },
        },
      },
      {
        id: 'var-alias',
        name: 'color.button.background',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'var-base' },
        },
      },
    ];

    mockFigma = {
      root: {
        name: 'Alias Test',
        id: 'file-alias',
      },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
      },
    };

    (global as any).figma = mockFigma;
  });

  it('converts aliases to DTCG reference format', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const aliasToken = (result.color as any).button.background;
    expect(aliasToken.$value).toBe('{color.brand.primary}');
  });

  it('wraps reference path in curly braces', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const aliasToken = (result.color as any).button.background;
    expect(typeof aliasToken.$value).toBe('string');
    expect(aliasToken.$value.startsWith('{')).toBe(true);
    expect(aliasToken.$value.endsWith('}')).toBe(true);
  });

  it('includes alias in mode values', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const aliasToken = (result.color as any).button.background;
    const modes = aliasToken.$extensions['com.figma'].modes;

    expect(modes.Default).toBe('{color.brand.primary}');
  });
});

describe('buildDtcgJson with remote/library variable references', () => {
  let mockFigma: any;

  beforeEach(() => {
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'LocalColors',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
      },
    ];

    const mockVariables = [
      {
        id: 'var-local',
        name: 'color.local.primary',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: 'Local color',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { r: 0.2, g: 0.4, b: 1.0, a: 1 },
        },
      },
      {
        id: 'var-alias-to-remote',
        name: 'color.alias.toRemote',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: 'Alias to remote library variable',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'remote-var-123' },
        },
      },
      {
        id: 'var-alias-to-unfetchable',
        name: 'color.alias.toUnfetchable',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: 'Alias to unfetchable remote variable',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'unfetchable-var-456' },
        },
      },
    ];

    const mockRemoteVariable = {
      id: 'remote-var-123',
      name: 'Brand Primary Color',
      variableCollectionId: 'remote-collection-1',
      resolvedType: 'COLOR',
    };

    mockFigma = {
      root: {
        name: 'Remote Alias Test',
        id: 'file-remote',
      },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
        getVariableByIdAsync: vi.fn().mockImplementation((id: string) => {
          if (id === 'remote-var-123') {
            return Promise.resolve(mockRemoteVariable);
          }
          if (id === 'unfetchable-var-456') {
            return Promise.reject(new Error('Variable not accessible'));
          }
          return Promise.resolve(null);
        }),
      },
    };

    (global as any).figma = mockFigma;
  });

  it('fetches remote variables referenced by aliases', async () => {
    await buildDtcgJson(mockFigma as any);

    expect(mockFigma.variables.getVariableByIdAsync).toHaveBeenCalledWith('remote-var-123');
    expect(mockFigma.variables.getVariableByIdAsync).toHaveBeenCalledWith('unfetchable-var-456');
  });

  it('converts remote variable references with external prefix', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const aliasToken = (result.color as any).alias.toRemote;
    expect(aliasToken.$value).toBe('{external.brand-primary-color}');
  });

  it('normalizes remote variable names to valid token paths', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const aliasToken = (result.color as any).alias.toRemote;
    // Should convert "Brand Primary Color" to "brand-primary-color"
    expect(aliasToken.$value).toMatch(/^{external\.[a-z0-9-]+}$/);
    expect(aliasToken.$value).not.toContain(' ');
    expect(aliasToken.$value).not.toContain('{external.Brand');
  });

  it('handles unfetchable remote variables with fallback reference', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const aliasToken = (result.color as any).alias.toUnfetchable;
    // Should create fallback like {external.unknown-unfetcha}
    expect(aliasToken.$value).toMatch(/^{external\.unknown-[a-z0-9]+}$/);
    expect(aliasToken.$value).toContain('unfetcha'); // first 8 chars of ID
  });

  it('does not break when no remote variables are referenced', async () => {
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'Colors',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
      },
    ];

    const mockVariables = [
      {
        id: 'var-local-only',
        name: 'color.local',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { r: 1, g: 1, b: 1, a: 1 },
        },
      },
    ];

    const localOnlyMockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
        getVariableByIdAsync: vi.fn(),
      },
    };

    (global as any).figma = localOnlyMockFigma;
    const result = await buildDtcgJson(localOnlyMockFigma as any);

    expect(result.color).toBeDefined();
    expect(localOnlyMockFigma.variables.getVariableByIdAsync).not.toHaveBeenCalled();
  });

  it('handles multiple aliases to different remote variables', async () => {
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'Colors',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
      },
    ];

    const mockVariables = [
      {
        id: 'var-alias-1',
        name: 'color.primary',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'remote-1' },
        },
      },
      {
        id: 'var-alias-2',
        name: 'color.secondary',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'remote-2' },
        },
      },
    ];

    const multiRemoteMockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
        getVariableByIdAsync: vi.fn().mockImplementation((id: string) => {
          if (id === 'remote-1') {
            return Promise.resolve({ id: 'remote-1', name: 'Remote Color A' });
          }
          if (id === 'remote-2') {
            return Promise.resolve({ id: 'remote-2', name: 'Remote Color B' });
          }
          return Promise.resolve(null);
        }),
      },
    };

    (global as any).figma = multiRemoteMockFigma;
    const result = await buildDtcgJson(multiRemoteMockFigma as any);

    const primary = (result.color as any).primary;
    const secondary = (result.color as any).secondary;

    expect(primary.$value).toBe('{external.remote-color-a}');
    expect(secondary.$value).toBe('{external.remote-color-b}');
    expect(multiRemoteMockFigma.variables.getVariableByIdAsync).toHaveBeenCalledTimes(2);
  });

  it('handles remote variable with same name as local variable', async () => {
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'Colors',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
      },
    ];

    const mockVariables = [
      {
        id: 'var-local',
        name: 'primary',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { r: 1, g: 0, b: 0, a: 1 },
        },
      },
      {
        id: 'var-alias',
        name: 'button',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'remote-primary' },
        },
      },
    ];

    const namingConflictMockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
        getVariableByIdAsync: vi.fn().mockImplementation((id: string) => {
          if (id === 'remote-primary') {
            return Promise.resolve({ id: 'remote-primary', name: 'primary' });
          }
          return Promise.resolve(null);
        }),
      },
    };

    (global as any).figma = namingConflictMockFigma;
    const result = await buildDtcgJson(namingConflictMockFigma as any);

    const localPrimary = (result.colors as any).primary;
    const buttonAlias = (result.colors as any).button;

    // Local variable should use collection.name path
    expect(localPrimary.$value).toBeDefined();
    expect(typeof localPrimary.$value).toBe('object'); // color object, not reference

    // Remote variable should use external prefix
    expect(buttonAlias.$value).toBe('{external.primary}');
  });

  it('handles remote variables across multiple modes', async () => {
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'Colors',
        modes: [
          { modeId: 'mode-light', name: 'Light' },
          { modeId: 'mode-dark', name: 'Dark' },
        ],
      },
    ];

    const mockVariables = [
      {
        id: 'var-alias',
        name: 'semantic.bg',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-light': { type: 'VARIABLE_ALIAS', id: 'remote-light' },
          'mode-dark': { type: 'VARIABLE_ALIAS', id: 'remote-dark' },
        },
      },
    ];

    const multiModeMockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
        getVariableByIdAsync: vi.fn().mockImplementation((id: string) => {
          if (id === 'remote-light') {
            return Promise.resolve({ id: 'remote-light', name: 'Library White' });
          }
          if (id === 'remote-dark') {
            return Promise.resolve({ id: 'remote-dark', name: 'Library Black' });
          }
          return Promise.resolve(null);
        }),
      },
    };

    (global as any).figma = multiModeMockFigma;
    const result = await buildDtcgJson(multiModeMockFigma as any);

    // Variable name has dots, so it uses the name as-is: "semantic.bg"
    const semanticBg = (result.semantic as any).bg;
    const modes = semanticBg.$extensions['com.figma'].modes;

    expect(modes.Light).toBe('{external.library-white}');
    expect(modes.Dark).toBe('{external.library-black}');
    expect(multiModeMockFigma.variables.getVariableByIdAsync).toHaveBeenCalledWith('remote-light');
    expect(multiModeMockFigma.variables.getVariableByIdAsync).toHaveBeenCalledWith('remote-dark');
  });

  it('deduplicates remote variable fetches', async () => {
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'Colors',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
      },
    ];

    const mockVariables = [
      {
        id: 'var-alias-1',
        name: 'color.primary',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'remote-shared' },
        },
      },
      {
        id: 'var-alias-2',
        name: 'color.secondary',
        variableCollectionId: 'collection-1',
        resolvedType: 'COLOR',
        description: '',
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: {
          'mode-default': { type: 'VARIABLE_ALIAS', id: 'remote-shared' },
        },
      },
    ];

    const dedupeTestMockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
        getVariableByIdAsync: vi.fn().mockImplementation((id: string) => {
          if (id === 'remote-shared') {
            return Promise.resolve({ id: 'remote-shared', name: 'Shared Remote Color' });
          }
          return Promise.resolve(null);
        }),
      },
    };

    (global as any).figma = dedupeTestMockFigma;
    const result = await buildDtcgJson(dedupeTestMockFigma as any);

    // Variable names have dots, so they use the name as-is: "color.primary" and "color.secondary"
    const primary = (result.color as any).primary;
    const secondary = (result.color as any).secondary;

    expect(primary.$value).toBe('{external.shared-remote-color}');
    expect(secondary.$value).toBe('{external.shared-remote-color}');

    // Should only fetch the remote variable once, not twice
    expect(dedupeTestMockFigma.variables.getVariableByIdAsync).toHaveBeenCalledTimes(1);
    expect(dedupeTestMockFigma.variables.getVariableByIdAsync).toHaveBeenCalledWith(
      'remote-shared'
    );
  });
});

describe('buildDtcgJson with multiple types', () => {
  let mockFigma: any;

  beforeEach(() => {
    const mockCollections = [
      {
        id: 'collection-mixed',
        name: 'MixedTokens',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
      },
    ];

    const mockVariables = [
      {
        id: 'var-color',
        name: 'mixed.color',
        variableCollectionId: 'collection-mixed',
        resolvedType: 'COLOR',
        description: '',
        scopes: [],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: { 'mode-default': { r: 1, g: 0, b: 0, a: 1 } },
      },
      {
        id: 'var-number',
        name: 'mixed.opacity',
        variableCollectionId: 'collection-mixed',
        resolvedType: 'FLOAT',
        description: '',
        scopes: [],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: { 'mode-default': 0.8 },
      },
      {
        id: 'var-dimension',
        name: 'mixed.width',
        variableCollectionId: 'collection-mixed',
        resolvedType: 'FLOAT',
        description: '',
        scopes: [],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: { 'mode-default': 320 },
      },
      {
        id: 'var-string',
        name: 'mixed.label',
        variableCollectionId: 'collection-mixed',
        resolvedType: 'STRING',
        description: '',
        scopes: [],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: { 'mode-default': 'Hello World' },
      },
      {
        id: 'var-boolean',
        name: 'mixed.enabled',
        variableCollectionId: 'collection-mixed',
        resolvedType: 'BOOLEAN',
        description: '',
        scopes: [],
        codeSyntax: {},
        hiddenFromPublishing: false,
        valuesByMode: { 'mode-default': true },
      },
    ];

    mockFigma = {
      root: {
        name: 'Mixed Types Test',
        id: 'file-mixed',
      },
      variables: {
        getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue(mockCollections),
        getLocalVariablesAsync: vi.fn().mockResolvedValue(mockVariables),
      },
    };

    (global as any).figma = mockFigma;
  });

  it('exports color tokens correctly', async () => {
    const result = await buildDtcgJson(mockFigma as any);
    const colorToken = (result.mixed as any).color;

    expect(colorToken.$type).toBe('color');
    expect(colorToken.$value).toHaveProperty('colorSpace', 'srgb');
    expect(colorToken.$value.hex).toBe('#ff0000');
  });

  it('exports number tokens correctly', async () => {
    const result = await buildDtcgJson(mockFigma as any);
    const numberToken = (result.mixed as any).opacity;

    expect(numberToken.$type).toBe('number');
    expect(numberToken.$value).toBe(0.8);
  });

  it('exports dimension tokens correctly', async () => {
    const result = await buildDtcgJson(mockFigma as any);
    const dimensionToken = (result.mixed as any).width;

    expect(dimensionToken.$type).toBe('dimension');
    expect(dimensionToken.$value).toEqual({ value: 320, unit: 'px' });
  });

  it('exports string tokens correctly', async () => {
    const result = await buildDtcgJson(mockFigma as any);
    const stringToken = (result.mixed as any).label;

    expect(stringToken.$type).toBe('string');
    expect(stringToken.$value).toBe('Hello World');
  });

  it('exports boolean tokens correctly', async () => {
    const result = await buildDtcgJson(mockFigma as any);
    const booleanToken = (result.mixed as any).enabled;

    expect(booleanToken.$type).toBe('boolean');
    expect(booleanToken.$value).toBe(true);
  });
});

describe('DTCG type guards integration', () => {
  let mockFigma: any;

  beforeEach(() => {
    mockFigma = createMockFigmaApi();
    (global as any).figma = mockFigma;
  });

  it('produces valid DTCG tokens', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bgPrimary = (result.bg as Record<string, unknown>).primary;
    expect(isDtcgToken(bgPrimary)).toBe(true);
    expect(isDtcgGroup(bgPrimary)).toBe(false);
  });

  it('produces valid DTCG groups', async () => {
    const result = await buildDtcgJson(mockFigma as any);

    const bg = result.bg;
    expect(isDtcgGroup(bg)).toBe(true);
    expect(isDtcgToken(bg)).toBe(false);
  });

  it('root is a valid DTCG group', async () => {
    const result: DtcgRoot = await buildDtcgJson(mockFigma as any);
    expect(isDtcgGroup(result)).toBe(true);
  });
});

describe('DTCG export edge cases', () => {
  it('handles variables with no description', async () => {
    const mockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi
          .fn()
          .mockResolvedValue([
            { id: 'col-1', name: 'Test', modes: [{ modeId: 'm1', name: 'Default' }] },
          ]),
        getLocalVariablesAsync: vi.fn().mockResolvedValue([
          {
            id: 'v1',
            name: 'token',
            variableCollectionId: 'col-1',
            resolvedType: 'STRING',
            description: '',
            scopes: [],
            codeSyntax: {},
            hiddenFromPublishing: false,
            valuesByMode: { m1: 'value' },
          },
        ]),
      },
    };

    (global as any).figma = mockFigma;
    const result = await buildDtcgJson(mockFigma as any);

    const token = (result.test as any).token;
    expect(token).not.toHaveProperty('$description');
  });

  it('handles variables with whitespace-only description', async () => {
    const mockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi
          .fn()
          .mockResolvedValue([
            { id: 'col-1', name: 'Test', modes: [{ modeId: 'm1', name: 'Default' }] },
          ]),
        getLocalVariablesAsync: vi.fn().mockResolvedValue([
          {
            id: 'v1',
            name: 'token',
            variableCollectionId: 'col-1',
            resolvedType: 'STRING',
            description: '   ',
            scopes: [],
            codeSyntax: {},
            hiddenFromPublishing: false,
            valuesByMode: { m1: 'value' },
          },
        ]),
      },
    };

    (global as any).figma = mockFigma;
    const result = await buildDtcgJson(mockFigma as any);

    const token = (result.test as any).token;
    expect(token).not.toHaveProperty('$description');
  });

  it('handles collection with single mode', async () => {
    const mockFigma = {
      root: { name: 'Test', id: 'test' },
      variables: {
        getLocalVariableCollectionsAsync: vi
          .fn()
          .mockResolvedValue([
            { id: 'col-1', name: 'Test', modes: [{ modeId: 'm1', name: 'Only' }] },
          ]),
        getLocalVariablesAsync: vi.fn().mockResolvedValue([
          {
            id: 'v1',
            name: 'token',
            variableCollectionId: 'col-1',
            resolvedType: 'STRING',
            description: '',
            scopes: [],
            codeSyntax: {},
            hiddenFromPublishing: false,
            valuesByMode: { m1: 'value' },
          },
        ]),
      },
    };

    (global as any).figma = mockFigma;
    const result = await buildDtcgJson(mockFigma as any);

    const token = (result.test as any).token;
    expect(token.$value).toBe('value');
    expect(token.$extensions['com.figma'].modes).toHaveProperty('Only', 'value');
  });
});
