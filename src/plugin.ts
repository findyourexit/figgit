/**
 * FigGit - Main Plugin Logic
 *
 * Runs inside the Figma plugin sandbox and coordinates:
 * - Exporting variables in the selected format
 * - Persisting settings and GitHub token state
 * - Handling GitHub commits and remote diffs
 */

/// <reference types="@figma/plugin-typings" />
import { buildExportBundle } from './export/buildExportBundle';
import { SETTINGS_KEY, defaultSettings, UIToPluginMessage, PersistedSettings } from './messaging';
import { commitFiles, fromBase64 } from './github/githubClient';
import { stableStringify } from './util/stableStringify';
import { buildRepoPath } from './util/path';
import { validateAllSettings } from './util/validation';

type CommitRequestMessage = Extract<UIToPluginMessage, { type: 'COMMIT_REQUEST' }>;

figma.showUI(__html__, { width: 600, height: 750, themeColors: true });

async function getStoredSettings(): Promise<PersistedSettings> {
  try {
    const raw = figma.root.getPluginData(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as PersistedSettings) };
  } catch {
    return defaultSettings();
  }
}

async function saveSettings(settings: PersistedSettings) {
  figma.root.setPluginData(SETTINGS_KEY, JSON.stringify(settings));
}

async function hasToken(): Promise<boolean> {
  return !!(await figma.clientStorage.getAsync('github_pat'));
}

async function postSettingsResponse(seed?: PersistedSettings) {
  const settings = seed ?? (await getStoredSettings());
  figma.ui.postMessage({
    type: 'SETTINGS_RESPONSE',
    payload: { ...settings, tokenPresent: await hasToken() },
  });
}

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

    const json = (await res.json()) as { login?: string };
    figma.ui.postMessage({ type: 'TOKEN_VALIDATION', ok: true, login: json.login });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    figma.ui.postMessage({ type: 'TOKEN_VALIDATION', ok: false, error: message });
  }
}

async function handleExportRequest() {
  try {
    const settings = await getStoredSettings();
    const bundle = await buildExportBundle(figma, settings);
    figma.ui.postMessage({ type: 'EXPORT_RESULT', ok: true, data: bundle });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    figma.ui.postMessage({ type: 'EXPORT_RESULT', ok: false, error: message });
  }
}

async function handleCommitRequest(msg: CommitRequestMessage) {
  try {
    const exportBundle = msg.exportBundle;
    if (!exportBundle || !exportBundle.documents.length) {
      figma.ui.postMessage({
        type: 'COMMIT_RESULT',
        ok: false,
        error: 'No export data to commit',
      });
      return;
    }

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

    const storedHashes = getLastHashMap(settings);
    const pendingDocs = exportBundle.documents.filter(
      (doc) => storedHashes[doc.relativePath] !== doc.contentHash
    );

    if (!pendingDocs.length) {
      figma.ui.postMessage({ type: 'COMMIT_RESULT', ok: true, skipped: true });
      return;
    }

    const overridePrefix = msg.commitPrefix?.trim();
    const defaultPrefix = settings.commitPrefix?.trim();
    const prefixValue = overridePrefix || defaultPrefix || '';
    const prefix = prefixValue ? `${prefixValue} ` : '';
    const timestamp = new Date().toISOString();
    const vars = exportBundle.summary.variablesCount;
    const cols = exportBundle.summary.collectionsCount;
    const commitMessage = `${prefix}update Figma variables (${vars} vars, ${cols} collections) - ${timestamp}`;

    const files = pendingDocs.map((doc) => ({
      path: doc.relativePath,
      content: stableStringify(doc.data, 2),
      contentHash: doc.contentHash,
    }));

    const result = await commitFiles({
      owner: settings.owner,
      repo: settings.repo,
      branch: settings.branch,
      token,
      commitMessage,
      files,
    });

    const nextHashes = { ...storedHashes };
    for (const doc of exportBundle.documents) {
      nextHashes[doc.relativePath] = doc.contentHash;
    }

    await saveSettings({
      ...settings,
      lastHashes: nextHashes,
      lastHash: exportBundle.summary.contentHash,
    });

    figma.ui.postMessage({
      type: 'COMMIT_RESULT',
      ok: true,
      skipped: result.skipped,
      url: result.url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    figma.ui.postMessage({ type: 'COMMIT_RESULT', ok: false, error: formatGitHubError(message) });
  }
}

async function handleFetchRemoteExport(paths: string[]) {
  if (!paths.length) {
    figma.ui.postMessage({ type: 'FETCH_REMOTE_EXPORT_RESULT', ok: true, files: [] });
    return;
  }

  try {
    const settings = await getStoredSettings();
    if (!settings.owner || !settings.repo || !settings.branch) {
      throw new Error('Configure repository settings to fetch remote files');
    }

    const token = await figma.clientStorage.getAsync('github_pat');
    if (!token) {
      throw new Error('Missing token');
    }

    const normalizedPaths = Array.from(
      new Set(paths.map((path) => normalizeRepoPath(path)).filter((path) => path.length))
    );

    const results: Array<{ path: string; data?: unknown | null; error?: string }> = [];

    for (const path of normalizedPaths) {
      try {
        const encodedPath = encodeContentPath(path);
        const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}?ref=${settings.branch}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        });

        if (res.status === 404) {
          results.push({ path, data: null });
          continue;
        }

        if (!res.ok) {
          results.push({ path, error: `Status ${res.status}` });
          continue;
        }

        const json = await res.json();
        if (typeof json.content !== 'string') {
          results.push({ path, error: 'Missing content' });
          continue;
        }

        try {
          const decoded = fromBase64(json.content);
          const parsed = JSON.parse(decoded);
          results.push({ path, data: parsed });
        } catch (parseError) {
          const error = parseError instanceof Error ? parseError.message : 'Unknown error';
          results.push({ path, error: 'Parse error: ' + error });
        }
      } catch (innerError) {
        const message = innerError instanceof Error ? innerError.message : 'Unknown error';
        results.push({ path, error: message });
      }
    }

    figma.ui.postMessage({ type: 'FETCH_REMOTE_EXPORT_RESULT', ok: true, files: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    figma.ui.postMessage({ type: 'FETCH_REMOTE_EXPORT_RESULT', ok: false, error: message });
  }
}

function normalizeRepoPath(path: string): string {
  return path.trim().replace(/\\+/g, '/').replace(/^\/+/g, '');
}

function encodeContentPath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function formatGitHubError(message: string): string {
  if (/401/.test(message)) return 'Unauthorized (check token)';
  if (/403/.test(message)) return 'Forbidden (check permissions)';
  if (/404/.test(message)) return 'Not found (check repository)';
  if (/409/.test(message)) return 'Conflict (branch updated)';
  if (/422/.test(message)) return 'Validation failed (check branch/path)';
  return message;
}

function getLastHashMap(settings: PersistedSettings): Record<string, string> {
  const map = { ...(settings.lastHashes || {}) };
  if (!Object.keys(map).length && settings.lastHash) {
    const legacyPath = buildRepoPath(settings.folder, settings.filename);
    map[legacyPath] = settings.lastHash;
  }
  return map;
}

figma.ui.onmessage = async (msg: UIToPluginMessage) => {
  switch (msg.type) {
    case 'REQUEST_EXPORT':
      await handleExportRequest();
      break;
    case 'REQUEST_SETTINGS':
      await postSettingsResponse();
      break;
    case 'SAVE_SETTINGS': {
      const merged = { ...defaultSettings(), ...msg.payload };
      await saveSettings(merged);
      await postSettingsResponse(merged);
      break;
    }
    case 'SAVE_TOKEN':
      try {
        const trimmed = msg.token.trim();
        if (!trimmed) {
          figma.ui.postMessage({
            type: 'NOTIFY',
            level: 'error',
            message: 'Token cannot be empty',
          });
          return;
        }
        await figma.clientStorage.setAsync('github_pat', trimmed);
        figma.ui.postMessage({ type: 'NOTIFY', level: 'info', message: 'Token stored locally' });
        await postSettingsResponse();
        await validateTokenAndNotify();
      } catch {
        figma.ui.postMessage({ type: 'NOTIFY', level: 'error', message: 'Failed saving token' });
      }
      break;
    case 'CLEAR_TOKEN':
      await figma.clientStorage.deleteAsync('github_pat');
      figma.ui.postMessage({ type: 'NOTIFY', level: 'info', message: 'Token cleared' });
      await postSettingsResponse();
      break;
    case 'VALIDATE_TOKEN':
      await validateTokenAndNotify();
      break;
    case 'COMMIT_REQUEST':
      await handleCommitRequest(msg);
      break;
    case 'FETCH_REMOTE_EXPORT':
      await handleFetchRemoteExport(msg.files);
      break;
    case 'COPY_TO_CLIPBOARD':
      break;
    case 'NOTIFY':
      figma.notify(msg.message, { error: msg.level === 'error' });
      break;
    case 'PING':
      figma.ui.postMessage({ type: 'NOTIFY', level: 'info', message: 'Plugin ready' });
      break;
  }
};

figma.on('run', async () => {
  figma.ui.show();
  figma.ui.resize(600, 750);
  await postSettingsResponse();
});
