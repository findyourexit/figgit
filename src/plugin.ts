/**
 * FigGit - Main Plugin Logic
 *
 * This file runs in the Figma plugin sandbox (restricted JavaScript environment).
 * It handles:
 * - Variable extraction from Figma files
 * - Communication with the UI via postMessage
 * - Settings persistence in Figma's plugin data storage
 * - Secure GitHub token storage in clientStorage
 * - GitHub API interactions for committing files
 *
 * Note: No access to browser APIs - uses pure JavaScript implementations
 * for SHA-256, Base64 encoding, and UTF-8 conversion.
 */

/// <reference types="@figma/plugin-typings" />
import { buildVariablesJson } from './export/buildVariablesJson';
import {
  SETTINGS_KEY,
  defaultSettings,
  UIToPluginMessage,
  PluginToUIMessage,
  PersistedSettings,
} from './messaging';
import { upsertFile, fromBase64 } from './github/githubClient';
import { stableStringify } from './util/stableStringify';
import { validateAllSettings } from './util/validation';

// Show UI on plugin start
figma.showUI(__html__, { width: 520, height: 620, themeColors: true });

/**
 * Retrieves plugin settings from Figma's persistent storage.
 *
 * Settings are stored in the root node's plugin data and include:
 * - GitHub repository configuration (owner, repo, branch)
 * - Output file settings (folder, filename)
 * - Commit customization (prefix)
 * - Last known content hash (for change detection)
 *
 * @returns Promise resolving to persisted settings or defaults if none exist
 */
async function getStoredSettings(): Promise<PersistedSettings> {
  try {
    const raw = figma.root.getPluginData(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as PersistedSettings) };
  } catch {
    return defaultSettings();
  }
}

/**
 * Saves plugin settings to Figma's persistent storage.
 *
 * These settings persist across plugin sessions and are specific to the current
 * Figma file (not shared across files or users).
 *
 * @param settings - Settings object to persist
 */
async function saveSettings(settings: PersistedSettings) {
  figma.root.setPluginData(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Checks if a GitHub Personal Access Token is stored.
 *
 * Tokens are stored in clientStorage (secure, local-only storage) and are:
 * - Never exported or sent to the UI after initial save
 * - Accessible only within the plugin sandbox
 * - Persistent across plugin sessions
 *
 * @returns Promise resolving to true if token exists, false otherwise
 */
async function hasToken(): Promise<boolean> {
  return (await figma.clientStorage.getAsync('github_pat')) ? true : false;
}

/**
 * Validates the stored GitHub token by calling the GitHub API.
 *
 * Makes a test request to https://api.github.com/user to verify:
 * - Token is valid and not expired
 * - Token has necessary permissions
 * - Network connectivity to GitHub
 *
 * Sends result back to UI via TOKEN_VALIDATION message.
 */
async function validateTokenAndNotify() {
  try {
    const token = await figma.clientStorage.getAsync('github_pat');
    if (!token) {
      figma.ui.postMessage({ type: 'TOKEN_VALIDATION', ok: false, error: 'No token stored' });
      return;
    }
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      figma.ui.postMessage({ type: 'TOKEN_VALIDATION', ok: false, error: `Status ${res.status}` });
      return;
    }
    const json = (await res.json()) as { login: string };
    figma.ui.postMessage({ type: 'TOKEN_VALIDATION', ok: true, login: json.login });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Validation failed';
    figma.ui.postMessage({ type: 'TOKEN_VALIDATION', ok: false, error });
  }
}

/**
 * Message handler for UI-to-Plugin communication.
 *
 * Handles all messages sent from the React UI via postMessage:
 *
 * REQUEST_EXPORT: Extract variables from current Figma file
 * FETCH_REMOTE_EXPORT: Fetch existing JSON from GitHub repository
 * REQUEST_SETTINGS: Send current settings to UI
 * SAVE_SETTINGS: Persist settings to plugin data
 * SAVE_TOKEN: Store GitHub token in clientStorage
 * CLEAR_TOKEN: Remove GitHub token from clientStorage
 * VALIDATE_TOKEN: Test GitHub token validity
 * COMMIT_REQUEST: Commit exported JSON to GitHub
 *
 * All responses are sent back to UI via postMessage with appropriate
 * message types defined in messaging.ts.
 */
figma.ui.onmessage = async (msg: UIToPluginMessage) => {
  // Extract variables from the current Figma file
  if (msg.type === 'REQUEST_EXPORT') {
    try {
      const data = await buildVariablesJson(figma);
      figma.ui.postMessage({ type: 'EXPORT_RESULT', ok: true, data } as PluginToUIMessage);
    } catch (e) {
      figma.ui.postMessage({
        type: 'EXPORT_RESULT',
        ok: false,
        error: (e as Error).message,
      } as PluginToUIMessage);
    }
  }

  // Fetch existing exported JSON from GitHub for diff comparison
  if (msg.type === 'FETCH_REMOTE_EXPORT') {
    try {
      const settings = await getStoredSettings();
      const token = await figma.clientStorage.getAsync('github_pat');
      if (!token) {
        figma.ui.postMessage({
          type: 'FETCH_REMOTE_EXPORT_RESULT',
          ok: false,
          error: 'Missing token',
        });
        return;
      }
      const path =
        (settings.folder
          ? settings.folder.replace(/\\+/g, '/').replace(/^\//, '').replace(/\/$/, '') + '/'
          : '') + settings.filename;
      const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodeURIComponent(path)}?ref=${settings.branch}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        figma.ui.postMessage({ type: 'FETCH_REMOTE_EXPORT_RESULT', ok: true, data: null });
        return;
      }
      if (!res.ok) {
        figma.ui.postMessage({
          type: 'FETCH_REMOTE_EXPORT_RESULT',
          ok: false,
          error: `Status ${res.status}`,
        });
        return;
      }
      const json = await res.json();
      try {
        const decoded = fromBase64(json.content);
        const parsed = JSON.parse(decoded);
        figma.ui.postMessage({ type: 'FETCH_REMOTE_EXPORT_RESULT', ok: true, data: parsed });
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown';
        figma.ui.postMessage({
          type: 'FETCH_REMOTE_EXPORT_RESULT',
          ok: false,
          error: 'Parse error: ' + error,
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      figma.ui.postMessage({ type: 'FETCH_REMOTE_EXPORT_RESULT', ok: false, error });
    }
  }

  // Send current settings to UI (requested on plugin load and after changes)
  if (msg.type === 'REQUEST_SETTINGS') {
    const s = await getStoredSettings();
    figma.ui.postMessage({
      type: 'SETTINGS_RESPONSE',
      payload: { ...s, tokenPresent: await hasToken() },
    } as PluginToUIMessage);
  }

  // Save repository/export settings (not including token)
  if (msg.type === 'SAVE_SETTINGS') {
    await saveSettings(msg.payload);
    figma.ui.postMessage({
      type: 'NOTIFY',
      level: 'info',
      message: 'Settings saved',
    } as PluginToUIMessage);
  }

  // Store GitHub Personal Access Token in secure clientStorage
  if (msg.type === 'SAVE_TOKEN') {
    try {
      await figma.clientStorage.setAsync('github_pat', msg.token.trim());
      figma.ui.postMessage({ type: 'NOTIFY', level: 'info', message: 'Token stored locally' });
      figma.ui.postMessage({
        type: 'SETTINGS_RESPONSE',
        payload: { ...(await getStoredSettings()), tokenPresent: true },
      });
      // Auto validate after save
      await validateTokenAndNotify();
    } catch {
      figma.ui.postMessage({ type: 'NOTIFY', level: 'error', message: 'Failed saving token' });
    }
  }

  // Remove GitHub token from clientStorage
  if (msg.type === 'CLEAR_TOKEN') {
    await figma.clientStorage.deleteAsync('github_pat');
    figma.ui.postMessage({ type: 'NOTIFY', level: 'info', message: 'Token cleared' });
    figma.ui.postMessage({
      type: 'SETTINGS_RESPONSE',
      payload: { ...(await getStoredSettings()), tokenPresent: false },
    });
  }

  // Test GitHub token validity
  if (msg.type === 'VALIDATE_TOKEN') {
    await validateTokenAndNotify();
  }

  // Commit exported variables JSON to GitHub
  if (msg.type === 'COMMIT_REQUEST') {
    try {
      const exportData = msg.exportData;

      // Handle dry run mode (test without actually committing)
      if (msg.dryRun) {
        figma.ui.postMessage({ type: 'COMMIT_RESULT', ok: true, skipped: true });
        return;
      }

      const token = await figma.clientStorage.getAsync('github_pat');
      if (!token) {
        figma.ui.postMessage({ type: 'COMMIT_RESULT', ok: false, error: 'Missing token' });
        return;
      }
      const settings = await getStoredSettings();

      // Validate settings before proceeding
      const validationResult = validateAllSettings({
        owner: settings.owner,
        repo: settings.repo,
        branch: settings.branch,
        filename: settings.filename,
        folder: settings.folder,
      });
      if (!validationResult.valid) {
        figma.ui.postMessage({
          type: 'COMMIT_RESULT',
          ok: false,
          error: `Validation error: ${validationResult.error}`,
        });
        return;
      }

      const newHash = exportData.meta.contentHash || '';

      // Hash comparison happens only here in the plugin (single source of truth)
      // This prevents redundant commits when content hasn't actually changed
      if (settings.lastHash && settings.lastHash === newHash) {
        figma.ui.postMessage({ type: 'COMMIT_RESULT', ok: true, skipped: true });
        return;
      }

      // Build commit message with variable/collection counts and timestamp
      const vars = exportData.meta.variablesCount;
      const cols = exportData.meta.collectionsCount;
      const ts = new Date().toISOString();
      const prefix =
        msg.commitPrefix || settings.commitPrefix
          ? `${msg.commitPrefix || settings.commitPrefix} `
          : '';
      const commitMessage = `${prefix}chore(design): update Figma variables (${vars} vars, ${cols} collections) - ${ts}`;
      const path =
        (settings.folder
          ? settings.folder.replace(/\\+/g, '/').replace(/^\//, '').replace(/\/$/, '') + '/'
          : '') + settings.filename;
      const json = stableStringify(exportData, 2);

      // Attempt to commit to GitHub (with automatic retry on 409 conflicts)
      const result = await upsertFile({
        owner: settings.owner,
        repo: settings.repo,
        branch: settings.branch,
        path,
        content: json,
        token,
        commitMessage,
        currentHash: newHash as string,
      });

      // Update stored hash only if commit succeeded and wasn't skipped
      if (!result.skipped && newHash) {
        await saveSettings({ ...settings, lastHash: newHash });
      }

      figma.ui.postMessage({
        type: 'COMMIT_RESULT',
        ok: true,
        skipped: result.skipped,
        url: result.url,
      });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('Commit error:', error);
      let msgText = error.message || 'Unknown error';
      // Add stack trace for debugging if available
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
      // Provide user-friendly error messages for common HTTP status codes
      if (/401/.test(msgText)) msgText = 'Unauthorized (check token)';
      else if (/403/.test(msgText)) msgText = 'Forbidden (check permissions)';
      else if (/404/.test(msgText)) msgText = 'Not found (check repository)';
      else if (/422/.test(msgText)) msgText = 'Validation failed (check branch/file path)';
      figma.ui.postMessage({ type: 'COMMIT_RESULT', ok: false, error: msgText });
    }
  }
};

/**
 * Optional run handler for future command integration.
 *
 * This allows the plugin to be manually triggered via Figma's command palette
 * or other plugin entry points.
 */
figma.on('run', () => {
  figma.ui.show();
  figma.ui.resize(520, 620);
  figma.ui.postMessage({ type: 'REQUEST_SETTINGS' });
});
