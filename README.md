# FigGit

[![CI Status](https://github.com/findyourexit/figgit/workflows/CI/badge.svg)](https://github.com/findyourexit/figgit/actions)
[![Test Coverage](https://img.shields.io/badge/coverage-86.44%25-brightgreen)](https://github.com/findyourexit/figgit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG-2.1%20Level%20AA-green)](https://www.w3.org/WAI/WCAG21/quickref/)

A Figma plugin that extracts design variables (colors, typography, spacing, etc.) and commits them as JSON to a GitHub repository.

## Features

- **One(ish)-click Export**: Extract all Figma variables with full metadata
- **Direct GitHub Integration**: Commit directly to any branch (creates branch if needed)
- **Smart Change Detection**: SHA-256 content hashing prevents redundant commits
- **Diff Preview**: See changes before committing (added/modified/removed variables)
- **Dry Run Mode**: Test without committing to verify changes
- **Automatic Conflict Resolution**: Auto-retry on 409 conflicts
- **Rich Metadata**: Includes export timestamp, plugin version, file info, and content hash
- **Secure Token Storage**: GitHub PAT stored only in Figma's clientStorage (never exported)
- **Keyboard Shortcuts**: ⌘/Ctrl+E to export, ⌘/Ctrl+Enter to commit, Esc to close
- **Dark Mode Support**: Automatic theme matching with Figma (⚠️ WIP)
- 
## Quick Installation

1. **Extract this ZIP file** to a folder on your computer (remember where you put it!)
2. **Open Figma Desktop** (download from <https://www.figma.com/downloads/> if you don't have it)
3. In Figma, go to **Menu** → **Plugins** → **Development** → **Import plugin from manifest...**
4. Navigate to the folder where you extracted these files
5. Select `manifest.json`
6. Done! The plugin will appear under **Plugins** → **Development** → **FigGit**

> [!TIP]
> When using the plugin, you'll be given an opportunity to save your input settings, using the "Save Settings" button - this is highly recommended, as it'll make your life easier for the next time you're exporting Figma design tokens!

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
3. In Figma: **Menu** → **Plugins** → **Development** → **Reload plugin**

## JSON Output Schema

> [!WARNING]
> The JSON schema is subject to change until `v1.0.0` release. Please avoid relying on it for production use until then.

The plugin exports a structured JSON file with complete variable information:

```json
{
  "meta": {
    "exportedAt": "2025-01-15T10:30:00.000Z",
    "fileName": "Design System",
    "pluginVersion": "0.1.0",
    "figmaFileId": "abc123def456",
    "collectionsCount": 3,
    "variablesCount": 42,
    "contentHash": "sha256:a1b2c3..."
  },
  "collections": [
    {
      "id": "VariableCollectionId:123:456",
      "name": "Color / Theme",
      "modes": [
        {
          "id": "123:0",
          "name": "Light"
        }
      ],
      "variables": [
        {
          "id": "VariableID:789:012",
          "name": "color.bg.default",
          "resolvedType": "COLOR",
          "isAlias": false,
          "scopes": ["ALL_SCOPES"],
          "valuesByMode": {
            "123:0": {
              "type": "COLOR",
              "value": {
                "r": 1,
                "g": 1,
                "b": 1,
                "a": 1
              }
            }
          }
        }
      ]
    }
  ]
}
```

## Installation

### Requirements

- **Figma Desktop** (plugin API not available in browser version)
- **Node.js 18+** (for building the plugin)
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

1. **Open Plugin**: In Figma Desktop, run the plugin from the Plugins menu
2. **Configure Repository**:
   - Enter GitHub owner (username or organization)
   - Enter repository name
   - Specify target branch (will be created if it doesn't exist)
   - (Optional) Specify folder path within the repo
   - Set output filename (must end with `.json`)
   - (Optional) Add commit message prefix (e.g., `feat(tokens):`)
3. **Save Token**:
   - Paste your GitHub Personal Access Token
   - Click "Save GitHub Token"
   - Click "Validate" to verify access
4. **Export Variables**:
   - Click "Export Variables" to extract all variables from the current Figma file
   - Review the JSON preview (click to expand)
   - (Optional) Copy JSON to clipboard
5. **Commit Changes**:
   - (Optional) Enable "Dry run" to test without committing
   - Click "Commit to GitHub"
   - If variables haven't changed, commit is automatically skipped
   - If committed, you'll see a link to the updated file

### Commit Message Format

> [!NOTE]
> Since the plugin is still heavily under development, the commit message format will be changing in the lead up to the `v1.0.0` release, as it presently hard-codes the `chore(design)` conventional commit prefix (often causing duplication when a user-defined prefix is added).

```text
[<prefix>] chore(design): update Figma variables (<count> vars, <collections> collections) - <timestamp>
```

Example with prefix:

```text
feat(tokens): chore(design): update Figma variables (128 vars, 7 collections) - 2025-01-15T10:30:00.123Z
```

Example without prefix:

```text
chore(design): update Figma variables (42 vars, 3 collections) - 2025-01-15T10:30:00.123Z
```

## How It Works

### Smart Change Detection

The plugin uses SHA-256 content hashing to detect changes:

1. **Local Cache**: Stores hash of last export to skip unnecessary network calls
2. **Remote Comparison**: Compares with `meta.contentHash` in remote file
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
├── plugin.ts                    # Main plugin logic (Figma sandbox)
├── messaging.ts                 # Type-safe UI ↔ Plugin communication
├── export/
│   ├── buildVariablesJson.ts   # Variable extraction & JSON building
│   └── hash.ts                 # Pure JavaScript SHA-256 implementation
├── github/
│   └── githubClient.ts         # GitHub API client with base64 encoding
├── ui/
│   ├── index.tsx               # React UI component
│   ├── styles.css              # UI styling
│   └── components/             # Reusable UI components
└── util/
    ├── stableStringify.ts      # Deterministic JSON serialization
    └── validation.ts           # Input validation helpers
```

### Build Commands

```bash
# Development mode (watch for changes)
npm run watch

# Production build
npm run build

# Test deterministic hashing
npm run test:determinism
```

## Support & Contributing

For issues or questions, please open an issue on GitHub.

> [!NOTE]
> Developer documentation is coming soon (including contribution guidelines).

All contributions welcome! To contribute to the project, please follow the usual steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in Figma Desktop
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) file for details
