<div align="center">
  <img src="assets/logo.png" alt="FigGit Logo" width="128"/>
</div>

# FigGit

[![CI Status](https://github.com/findyourexit/figgit/workflows/CI/badge.svg)](https://github.com/findyourexit/figgit/actions)
[![Test Coverage](https://img.shields.io/badge/coverage-94.51%25-brightgreen)](https://github.com/findyourexit/figgit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- ![Version](https://img.shields.io/github/v/release/findyourexit/figgit) -->

![Figma](https://img.shields.io/badge/Figma-Plugin-F24E1E?logo=figma&logoColor=white)
![DTCG](https://img.shields.io/badge/DTCG-v2025.10-blue)
![Code Style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)

A Figma plugin that extracts design variables (colors, typography, spacing, etc.) and commits them as [DTCG-compliant](https://www.designtokens.org/) JSON to a GitHub repository.

## Features

- **DTCG-Compliant Export**: Exports design tokens following the [Design Tokens Community Group (DTCG) specification v2025.10](https://www.designtokens.org/tr/2025.10/)
- **One-Click Export**: Extract all Figma variables with full metadata
- **Tab-Based Interface**: Organized UI with Export, Preview, and Settings tabs
- **Direct GitHub Integration**: Commit directly to any branch (creates branch if needed)
- **Smart Change Detection**: SHA-256 content hashing prevents redundant commits
- **Diff Preview**: See token-level changes before committing (added/modified/removed)
- **JSON Preview**: View and copy exported DTCG JSON directly in the plugin
- **Dry Run Mode**: Test without committing to verify changes
- **Automatic Conflict Resolution**: Auto-retry on 409 conflicts
- **Remote Variable Support**: Handles references to external/library variables
- **Rich Metadata**: Includes export timestamp, plugin version, file info, and content hash
- **Secure Token Storage**: GitHub PAT stored only in Figma's clientStorage (never exported)
- **Dark Mode Support**: Automatic theme matching with Figma

## Quick Installation

> [!NOTE]
> For the latest release, visit the [Releases page](https://github.com/findyourexit/figgit/releases).

1. **Download the latest release** from the [Releases page](https://github.com/findyourexit/figgit/releases).
2. **Extract the ZIP file** to a folder on your computer (remember where you put it!).
3. **Open Figma Desktop** (download from <https://www.figma.com/downloads/> if you don't have it).
4. In Figma, go to **Menu** → **Plugins** → **Development** → **Import plugin from manifest...**
5. Navigate to the folder where you extracted the files.
6. Select `manifest.json`.
7. Done! The plugin will appear under **Plugins** → **Development** → **FigGit**.

> [!TIP]
> The plugin will remember your settings between sessions. Use the "Settings" tab to configure your repository and save your GitHub token for easy reuse.

## What's in this package?

This development package contains three files:

- `manifest.json` - Plugin configuration (required for import)
- `plugin.js` - The plugin's backend code
- `index.html` - The plugin's user interface

All three files must stay together in the same folder.

## Updating

When a new version is available:

1. Download the latest build
2. Extract it to the **same folder** (overwrite existing files)
3. In Figma Desktop: **Plugins** → **Development** → **Hot reload plugin**

## JSON Output Schema

The plugin exports design tokens in [DTCG (Design Tokens Community Group) format v2025.10](https://www.designtokens.org/tr/2025.10/), a standardized format for exchanging design tokens between tools.

### DTCG Format Structure

Tokens are organized in nested groups with the following properties:

- `$value`: The token's value in the primary mode
- `$type`: Token type (color, dimension, number, string, boolean, fontFamily, etc.)
- `$description`: Optional human-readable description
- `$extensions`: Tool-specific metadata (Figma stores modes, scopes, codeSyntax here)

**Token Path Convention:**

- If variable name contains dots: use name as-is (e.g., `color.bg.default` → `color.bg.default`)
- If variable name has no dots: combine collection + variable name (e.g., Collection: `Colors`, Variable: `primary` → `colors.primary`)
- Remote/library variables: prefixed with `external.*`

Example DTCG export:

```json
{
  "color": {
    "bg": {
      "default": {
        "$value": "#ffffff",
        "$type": "color",
        "$extensions": {
          "com.figma": {
            "modes": {
              "Light": "#ffffff",
              "Dark": "#1a1a1a"
            },
            "scopes": ["ALL_SCOPES"],
            "codeSyntax": {},
            "hiddenFromPublishing": false
          }
        }
      }
    }
  },
  "spacing": {
    "sm": {
      "$value": {
        "value": 8,
        "unit": "px"
      },
      "$type": "dimension"
    }
  },
  "$extensions": {
    "com.figma": {
      "exportedAt": "2025-01-15T10:30:00.000Z",
      "fileName": "Design System",
      "pluginVersion": "0.2.0",
      "collectionsCount": 3,
      "variablesCount": 42,
      "contentHash": "sha256:a1b2c3..."
    }
  }
}
```

### Key Features

- **Nested Groups**: Tokens organized by dot-separated paths (e.g., `color.bg.default`)
- **Multi-Mode Support**: All mode values stored in `$extensions.com.figma.modes` (primary mode in `$value`)
- **Alias References**: References use DTCG format `{path.to.token}`
- **Type Safety**: Explicit `$type` for each token with automatic type inference
- **Smart Type Detection**: Dimension vs number distinction based on token path and scopes
- **Color Format**: Colors exported as hex strings in sRGB color space
- **Metadata**: Export metadata in `$extensions.com.figma` at root level

### Supported Token Types

| DTCG Type    | Figma Type                  | Example Value                    |
|--------------|-----------------------------|----------------------------------|
| `color`      | COLOR                       | `"#ffffff"` or `{color.primary}` |
| `dimension`  | FLOAT (with px/rem context) | `{"value": 16, "unit": "px"}`    |
| `number`     | FLOAT                       | `1.5`                            |
| `string`     | STRING                      | `"Roboto"`                       |
| `boolean`    | BOOLEAN                     | `true`                           |
| `fontFamily` | STRING (font context)       | `"Inter"`                        |

## Installation

### Requirements

- **Figma Desktop** (plugin API not available in browser version)
- **Node.js 20+** (for building the plugin)
- **GitHub Repository** with write access
- **GitHub Personal Access Token** (fine-grained or classic with `repo` scope)

### Build & Install

```bash
# Clone and install dependencies
npm install

# Build the plugin
npm run build
```

In Figma Desktop:

1. Go to **Plugins** > **Development** > **Import plugin from manifest...**
2. Select `manifest.json` from this project directory
3. The plugin will appear in your Plugins menu

### GitHub Token Setup

Create a Personal Access Token (PAT) with repository write access:

**Fine-grained token** (recommended):

- Permissions: Contents → Read and write

**Classic token**:

- Private repos: `repo` scope
- Public repos: `public_repo` scope

The token is stored securely in Figma's `clientStorage` and never exported or sent back to the UI after saving.

## How to Use

In Figma Desktop, run the plugin from the Plugins menu.

### Settings Tab

Configure your GitHub repository and authentication:

#### Configure Repository

- Enter GitHub owner (username or organization)
- Enter repository name
- Specify target branch (will be created if it doesn't exist)
- (Optional) Specify folder path within the repo
- Set output filename (must end with `.json`)

#### Save Token

- Paste your GitHub Personal Access Token
- Click "Save GitHub Token"
- Click "Validate" to verify access

#### Advanced Options (Optional)

- Add commit message prefix (e.g., `feat(tokens):`)
- Enable dry run mode to test without committing

### Export Tab

Extract and commit your design tokens:

#### Export Variables

- Click "Export Variables" to extract all variables from the current Figma file
- View export status and metadata (variable count, collection count)

#### Commit Changes

- Click "Commit to GitHub" (or "Dry Run" if enabled)
- If variables haven't changed, commit is automatically skipped
- If committed, you'll see a link to the updated file

### Preview Tab

Review your export before committing:

#### Review Changes

- View the exported DTCG JSON (expandable, with copy to clipboard)
- Open "Diff Viewer" to see token-level changes (added/removed/changed)
- Review changes before committing

### Commit Message Format

Commit messages are automatically generated with the following format:

```text
[<prefix>] update Figma variables (<count> vars, <collections> collections) - <timestamp>
```

Example with prefix:

```text
feat(tokens): update Figma variables (128 vars, 7 collections) - 2025-01-15T10:30:00.123Z
```

Example without prefix:

```text
update Figma variables (42 vars, 3 collections) - 2025-01-15T10:30:00.123Z
```

## How It Works

### Smart Change Detection

The plugin uses SHA-256 content hashing to detect changes:

1. **Local Cache**: Stores hash of last export to skip unnecessary network calls
2. **Remote Comparison**: Compares with `$extensions.com.figma.contentHash` in remote file
3. **Fallback**: If remote file lacks hash (manual edits), recomputes hash for comparison
4. **Skip Logic**: Only commits if content actually changed

### Dry Run Mode

Enable dry run to:

- Test configuration without committing
- Preview what would be committed
- Verify diff calculation
- Preserve last known hash state

### Automatic Branch Creation

If the specified branch doesn't exist, the plugin:

1. Fetches the repository's default branch
2. Creates the new branch from the default branch HEAD
3. Commits the variables file to the new branch

### Conflict Resolution

If a 409 conflict occurs (file modified by another process):

1. Automatically refetches the latest file SHA
2. Retries the commit once
3. If second attempt fails, surfaces error to user

## Development

### Project Structure

```text
src/
├── plugin.ts                   # Main plugin logic (Figma sandbox)
├── messaging.ts                # Type-safe UI ↔ Plugin communication
├── export/
│   ├── buildDtcgJson.ts        # DTCG-compliant variable extraction
│   ├── buildVariablesJson.ts   # Legacy format (deprecated)
│   └── hash.ts                 # Pure JavaScript SHA-256 implementation
├── github/
│   └── githubClient.ts         # GitHub API client with base64 encoding
├── shared/
│   ├── dtcg-types.ts           # DTCG type definitions
│   └── types.ts                # Legacy type definitions
├── ui/
│   ├── index.tsx               # Preact UI entry point
│   ├── components/             # UI components
│   │   ├── export/             # Export tab components
│   │   ├── preview/            # Preview tab components
│   │   ├── settings/           # Settings tab components
│   │   └── layout/             # Tab layout components
│   ├── context/                # Preact context providers
│   └── hooks/                  # Custom Preact hooks
└── util/
    ├── colorUtils.ts           # DTCG color conversion utilities
    ├── dtcgUtils.ts            # DTCG format utilities
    ├── stableStringify.ts      # Deterministic JSON serialization
    ├── validation.ts           # Input validation helpers
    └── retry.ts                # Retry logic for API calls
```

### Build Commands

```bash
# Development mode (watch for changes - both UI and plugin)
npm run dev

# Watch UI only
npm run dev:ui

# Watch plugin only
npm run dev:plugin

# Production build
npm run build

# Create release package (ZIP file)
npm run package

# Run tests
npm test

# Run tests with UI
npm test:ui

# Run tests with coverage
npm test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

## Support & Contributing

For issues or questions, please open an issue on [GitHub](https://github.com/findyourexit/figgit/issues).

> [!NOTE]
> Developer documentation is coming soon (including contribution guidelines).

All contributions welcome! To contribute to the project, please follow the usual steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in Figma Desktop
5. Submit a pull request

### Technology Stack

- **Language**: TypeScript `5.4`
- **UI Framework**: Preact with [@create-figma-plugin/ui](https://github.com/yuanqing/create-figma-plugin) components
- **Build Tools**: Vite (UI), esbuild (plugin)
- **Testing**: Vitest with jsdom
- **Code Quality**: ESLint, Prettier, Husky, lint-staged

## License

MIT License - see [LICENSE](./LICENSE) file for details
