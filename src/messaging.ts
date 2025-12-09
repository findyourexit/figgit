/**
 * Message type definitions for communication between UI and Plugin.
 *
 * This module defines the message protocol for postMessage-based communication
 * between the React UI (running in an iframe) and the plugin code (running in
 * the Figma sandbox). All messages are fully typed for compile-time safety.
 *
 * Communication is bidirectional:
 * - UI → Plugin: User actions and requests
 * - Plugin → UI: Responses, notifications, and state updates
 */

import type { ExportBundle, ExportFormat, ExportType } from './types/export';

/**
 * Messages sent from the UI to the Plugin.
 *
 * Each message type represents a specific action or request:
 * - REQUEST_EXPORT: Extract variables from current Figma file
 * - REQUEST_SETTINGS: Load persisted settings
 * - SAVE_SETTINGS: Save settings to plugin data storage
 * - SAVE_TOKEN: Store GitHub PAT in secure clientStorage
 * - CLEAR_TOKEN: Remove GitHub PAT from clientStorage
 * - VALIDATE_TOKEN: Test if stored token is valid
 * - COMMIT_REQUEST: Commit exported JSON to GitHub
 * - FETCH_REMOTE_EXPORT: Fetch existing JSON from GitHub for diff
 * - COPY_TO_CLIPBOARD: Copy text to system clipboard
 * - PING: Simple connectivity test
 */
export type UIToPluginMessage =
  | { type: 'REQUEST_EXPORT' }
  | { type: 'REQUEST_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: PersistedSettings }
  | { type: 'SAVE_TOKEN'; token: string }
  | { type: 'CLEAR_TOKEN' }
  | { type: 'VALIDATE_TOKEN' }
  | {
      type: 'COMMIT_REQUEST';
      exportBundle: ExportBundle;
      dryRun: boolean;
      commitPrefix: string;
    }
  | { type: 'FETCH_REMOTE_EXPORT'; files: string[] }
  | { type: 'COPY_TO_CLIPBOARD'; text: string } // Copy text to clipboard
  | { type: 'NOTIFY'; level: 'info' | 'error'; message: string } // Display notification in Figma UI
  | { type: 'PING' };

/**
 * Messages sent from the Plugin to the UI.
 *
 * Each message type represents a response or notification:
 * - EXPORT_RESULT: Result of variable extraction
 * - SETTINGS_RESPONSE: Current settings and token presence
 * - NOTIFY: Toast notification for user feedback
 * - TOKEN_VALIDATION: Result of token validation
 * - COMMIT_RESULT: Result of GitHub commit operation
 * - FETCH_REMOTE_EXPORT_RESULT: Remote file contents or null if not found
 */
export interface RemoteFileResult {
  path: string;
  data?: unknown | null;
  error?: string;
}

export type PluginToUIMessage =
  | { type: 'EXPORT_RESULT'; ok: true; data: ExportBundle }
  | { type: 'EXPORT_RESULT'; ok: false; error: string }
  | { type: 'SETTINGS_RESPONSE'; payload: PersistedSettings & { tokenPresent: boolean } }
  | { type: 'NOTIFY'; level: 'info' | 'error'; message: string }
  | { type: 'TOKEN_VALIDATION'; ok: boolean; login?: string; error?: string }
  | { type: 'COMMIT_RESULT'; ok: true; skipped?: boolean; url?: string }
  | { type: 'COMMIT_RESULT'; ok: false; error: string }
  | { type: 'FETCH_REMOTE_EXPORT_RESULT'; ok: true; files: RemoteFileResult[] }
  | { type: 'FETCH_REMOTE_EXPORT_RESULT'; ok: false; error: string };

/**
 * Persisted settings stored in Figma's plugin data storage.
 *
 * These settings are file-specific and persist across plugin sessions.
 * Stored in the root node's plugin data (not in clientStorage).
 */
export interface PersistedSettings {
  /** GitHub username or organization name */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Target branch name (e.g., 'main', 'develop') */
  branch: string;
  /** Optional folder path within repository (e.g., 'design-tokens') */
  folder: string;
  /** Filename for exported JSON (e.g., 'variables.json') */
  filename: string;
  /** Optional commit message prefix (e.g., 'feat(tokens)') */
  commitPrefix?: string;
  /** Dry run mode - test without actually committing */
  dryRun?: boolean;
  /** Last known content hash for change detection */
  lastHash?: string;
  /** Map of repo-relative file paths to last known content hashes */
  lastHashes?: Record<string, string>;
  /** Preferred export format */
  exportFormat?: ExportFormat;
  /** Export type for figma-native format */
  exportType?: ExportType;
}

/**
 * Storage key for persisted settings in plugin data.
 * Version suffix allows for future migration if schema changes.
 */
export const SETTINGS_KEY = 'figmaVarSync_settings_v1';

/**
 * Returns default settings for first-time users.
 *
 * @returns Default settings object with empty required fields
 */
export function defaultSettings(): PersistedSettings {
  return {
    owner: '',
    repo: '',
    branch: 'main',
    folder: '',
    filename: 'variables.json',
    commitPrefix: '',
    dryRun: false,
    exportFormat: 'dtcg',
    exportType: 'singleFile',
    lastHashes: {},
  };
}
