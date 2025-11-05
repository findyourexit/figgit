import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PluginToUIMessage } from '../messaging';
import { Button } from './components/Button';
import { TextInput } from './components/TextInput';
import { LoadingState } from './components/LoadingState';
import { ToastContainer } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { stableStringify } from '../util/stableStringify';
import { PluginProvider, usePlugin } from './context/PluginContext';
import {
  useNotifications,
  useSettings,
  useExport,
  useCommit,
  useGitHub,
  useNetworkStatus,
  useKeyboardShortcuts,
} from './hooks';
import {
  enhanceGitHubError,
  formatEnhancedError,
  validateSettingsWithGuidance,
} from './utils/errorMessages';

interface DiffSummaryCounts {
  addedVariables: number;
  removedVariables: number;
  changedVariables: number;
  addedCollections: number;
  removedCollections: number;
  renamedCollections: number;
}

interface DiffVariableChange {
  id: string;
  nameBefore: string;
  nameAfter: string;
  changedModes: { modeId: string; before: any; after: any }[];
}

interface DiffData {
  counts: DiffSummaryCounts;
  addedVariables: { id: string; name: string }[];
  removedVariables: { id: string; name: string }[];
  changedVariables: DiffVariableChange[];
  addedCollections: { id: string; name: string }[];
  removedCollections: { id: string; name: string }[];
  renamedCollections: { id: string; before: string; after: string }[];
  ready: boolean;
  error?: string;
  empty: boolean; // true if no remote file
}

const AppContent: React.FC = () => {
  // Custom hooks for state management
  const { notifications, notify, dismiss } = useNotifications();
  const { settings, tokenPresent, updateSettings, loadSettings } = useSettings();
  const { exportState, previewCollapsed, startExport, exportSuccess, exportError, togglePreview } =
    useExport();
  const { commitState, startCommit, commitSuccess, commitError } = useCommit();
  const {
    tokenInput,
    tokenValidation,
    updateTokenInput,
    clearTokenInput,
    setValidationChecking,
    setValidationValid,
    setValidationInvalid,
    resetValidation,
  } = useGitHub();
  const { isOnline } = useNetworkStatus();
  const { sendMessage } = usePlugin();

  // Local state for diff functionality
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const remoteRequestedRef = useRef(false);

  // Compute diff between old (remote) and new (local) export data
  const computeDiff = useCallback((oldData: any, newData: any): DiffData => {
    // Build index maps
    const oldCollections = new Map<string, any>(oldData.collections.map((c: any) => [c.id, c]));
    const newCollections = new Map<string, any>(newData.collections.map((c: any) => [c.id, c]));
    const addedCollections: { id: string; name: string }[] = [];
    const removedCollections: { id: string; name: string }[] = [];
    const renamedCollections: { id: string; before: string; after: string }[] = [];
    for (const [id, c] of newCollections) {
      if (!oldCollections.has(id)) addedCollections.push({ id, name: c.name });
      else {
        const old = oldCollections.get(id);
        if (old.name !== c.name) renamedCollections.push({ id, before: old.name, after: c.name });
      }
    }
    for (const [id, c] of oldCollections) {
      if (!newCollections.has(id)) removedCollections.push({ id, name: c.name });
    }
    // Variables diff
    const oldVars = new Map<string, any>();
    const newVars = new Map<string, any>();
    for (const c of oldData.collections)
      for (const v of c.variables) oldVars.set(v.id, { v, collection: c });
    for (const c of newData.collections)
      for (const v of c.variables) newVars.set(v.id, { v, collection: c });
    const addedVariables: { id: string; name: string }[] = [];
    const removedVariables: { id: string; name: string }[] = [];
    const changedVariables: DiffVariableChange[] = [];
    for (const [id, wrap] of newVars) {
      if (!oldVars.has(id)) addedVariables.push({ id, name: wrap.v.name });
      else {
        const { v: oldV } = oldVars.get(id);
        const newV = wrap.v;
        const nameBefore = oldV.name;
        const nameAfter = newV.name;
        const changedModes: { modeId: string; before: any; after: any }[] = [];
        // Compare modes present in either
        const modeIds = new Set<string>([
          ...Object.keys(oldV.valuesByMode),
          ...Object.keys(newV.valuesByMode),
        ]);
        for (const m of modeIds) {
          const ov = oldV.valuesByMode[m];
          const nv = newV.valuesByMode[m];
          // Simple deep-ish compare via stableStringify on value reference subset
          const svalO = ov ? stableStringify(ov) : undefined;
          const svalN = nv ? stableStringify(nv) : undefined;
          if (svalO !== svalN) {
            changedModes.push({ modeId: m, before: ov, after: nv });
          }
        }
        if (changedModes.length || nameBefore !== nameAfter) {
          changedVariables.push({ id, nameBefore, nameAfter, changedModes });
        }
      }
    }
    for (const [id, wrap] of oldVars) {
      if (!newVars.has(id)) removedVariables.push({ id, name: wrap.v.name });
    }
    const counts: DiffSummaryCounts = {
      addedVariables: addedVariables.length,
      removedVariables: removedVariables.length,
      changedVariables: changedVariables.length,
      addedCollections: addedCollections.length,
      removedCollections: removedCollections.length,
      renamedCollections: renamedCollections.length,
    };
    return {
      counts,
      addedVariables,
      removedVariables,
      changedVariables,
      addedCollections,
      removedCollections,
      renamedCollections,
      ready: true,
      empty: false,
    };
  }, []);

  // Handle plugin messages
  useEffect(() => {
    window.onmessage = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as PluginToUIMessage;
      if (!msg) return;

      if (msg.type === 'SETTINGS_RESPONSE') {
        loadSettings(msg.payload);
      }

      if (msg.type === 'EXPORT_RESULT') {
        if (msg.ok) {
          exportSuccess(msg.data);
          notify(
            'info',
            `Exported ${msg.data.meta.variablesCount} variables from ${msg.data.meta.collectionsCount} collections`
          );
        } else {
          const enhanced = enhanceGitHubError(msg.error || 'Export failed', {
            operation: 'fetch',
          });
          exportError(formatEnhancedError(enhanced));
          notify('error', formatEnhancedError(enhanced));
        }
      }

      if (msg.type === 'NOTIFY') {
        notify(msg.level, msg.message);
      }

      if (msg.type === 'TOKEN_VALIDATION') {
        if (msg.ok) {
          setValidationValid(msg.login || 'Unknown');
          notify('info', `Token valid (${msg.login})`);
        } else {
          const enhanced = enhanceGitHubError(msg.error || 'Validation failed', {
            operation: 'validate',
          });
          setValidationInvalid(formatEnhancedError(enhanced));
          notify('error', formatEnhancedError(enhanced));
        }
      }

      if (msg.type === 'COMMIT_RESULT') {
        if (msg.ok) {
          commitSuccess(msg.skipped || false, msg.url);
          if (msg.skipped) notify('info', 'No changes detected (commit skipped)');
          else notify('info', 'Commit succeeded');
        } else {
          const enhanced = enhanceGitHubError(msg.error || 'Commit failed', {
            owner: settings?.owner,
            repo: settings?.repo,
            operation: 'commit',
          });
          commitError(formatEnhancedError(enhanced));
          notify('error', formatEnhancedError(enhanced));
        }
      }

      if (msg.type === 'FETCH_REMOTE_EXPORT_RESULT') {
        if (!remoteRequestedRef.current) return;
        remoteRequestedRef.current = false;

        if (msg.ok) {
          if (msg.data === null) {
            setDiff({
              counts: {
                addedVariables: 0,
                removedVariables: 0,
                changedVariables: 0,
                addedCollections: 0,
                removedCollections: 0,
                renamedCollections: 0,
              },
              addedVariables: [],
              removedVariables: [],
              changedVariables: [],
              addedCollections: [],
              removedCollections: [],
              renamedCollections: [],
              ready: true,
              empty: true,
            });
          } else if (exportState.data) {
            const computed = computeDiff(msg.data, exportState.data);
            setDiff(computed);
          }
        } else {
          const enhanced = enhanceGitHubError(msg.error || 'Failed to fetch remote', {
            owner: settings?.owner,
            repo: settings?.repo,
            operation: 'fetch',
          });
          setDiff({
            counts: {
              addedVariables: 0,
              removedVariables: 0,
              changedVariables: 0,
              addedCollections: 0,
              removedCollections: 0,
              renamedCollections: 0,
            },
            addedVariables: [],
            removedVariables: [],
            changedVariables: [],
            addedCollections: [],
            removedCollections: [],
            renamedCollections: [],
            ready: true,
            empty: false,
            error: formatEnhancedError(enhanced),
          });
        }
      }
    };

    // Request settings on mount
    sendMessage({ type: 'REQUEST_SETTINGS' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Network status notifications
  useEffect(() => {
    if (!isOnline) {
      notify('error', 'You are offline. GitHub operations are disabled.');
    }
  }, [isOnline, notify]);

  // Actions
  const handleExport = useCallback(() => {
    startExport();
    sendMessage({ type: 'REQUEST_EXPORT' });
  }, [startExport, sendMessage]);

  const handleSaveSettings = useCallback(() => {
    if (!settings) return;

    // Validate settings before saving
    const validationError = validateSettingsWithGuidance({
      owner: settings.owner,
      repo: settings.repo,
      branch: settings.branch,
      filename: settings.filename,
    });

    if (validationError) {
      notify('error', formatEnhancedError(validationError));
      return;
    }

    sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
  }, [settings, sendMessage, notify]);

  const handleSaveToken = useCallback(() => {
    if (!tokenInput.trim()) return;
    sendMessage({ type: 'SAVE_TOKEN', token: tokenInput.trim() });
    clearTokenInput();
  }, [tokenInput, sendMessage, clearTokenInput]);

  const handleClearToken = useCallback(() => {
    sendMessage({ type: 'CLEAR_TOKEN' });
    resetValidation();
  }, [sendMessage, resetValidation]);

  const handleValidateToken = useCallback(() => {
    if (!isOnline) {
      notify('error', 'Cannot validate token while offline');
      return;
    }
    setValidationChecking();
    sendMessage({ type: 'VALIDATE_TOKEN' });
  }, [isOnline, setValidationChecking, sendMessage, notify]);

  const handleCommit = useCallback(() => {
    if (!exportState.data || !settings) return;

    if (!isOnline) {
      notify('error', 'Cannot commit while offline');
      return;
    }

    if (!tokenPresent) {
      commitError('Missing GitHub token');
      notify('error', 'Please save a GitHub token first');
      return;
    }

    startCommit();
    sendMessage({
      type: 'COMMIT_REQUEST',
      exportData: exportState.data,
      dryRun: settings.dryRun || false,
      commitPrefix: settings.commitPrefix || '',
    });
  }, [
    exportState.data,
    settings,
    isOnline,
    tokenPresent,
    startCommit,
    sendMessage,
    commitError,
    notify,
  ]);

  const handleRequestDiff = useCallback(() => {
    if (!exportState.data) return;

    if (!isOnline) {
      notify('error', 'Cannot fetch diff while offline');
      return;
    }

    remoteRequestedRef.current = true;
    setDiff({
      counts: {
        addedVariables: 0,
        removedVariables: 0,
        changedVariables: 0,
        addedCollections: 0,
        removedCollections: 0,
        renamedCollections: 0,
      },
      addedVariables: [],
      removedVariables: [],
      changedVariables: [],
      addedCollections: [],
      removedCollections: [],
      renamedCollections: [],
      ready: false,
      empty: false,
    });
    sendMessage({ type: 'FETCH_REMOTE_EXPORT' });
    setDiffOpen(true);
  }, [exportState.data, isOnline, sendMessage, notify]);

  const handleCopyJson = useCallback(async () => {
    if (!exportState.data) return;
    try {
      const text = stableStringify(exportState.data, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        notify('info', 'JSON copied to clipboard');
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
          notify('info', 'JSON copied to clipboard');
        } else {
          notify('error', 'Copy failed');
        }
      }
    } catch (err) {
      notify('error', 'Copy failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [exportState.data, notify]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCommit: () => {
      if (!commitState.inProgress && exportState.data && tokenPresent && isOnline) {
        handleCommit();
      }
    },
    onExport: () => {
      if (!exportState.loading) {
        handleExport();
      }
    },
    onClose: () => {
      // Close diff if open, otherwise close plugin
      if (diffOpen) {
        setDiffOpen(false);
      }
    },
  });

  // Helper functions
  const buildCommitMessagePreview = () => {
    if (!exportState.data || !settings) return '';
    const vars = exportState.data.meta.variablesCount;
    const cols = exportState.data.meta.collectionsCount;
    const ts = new Date().toISOString();
    const prefix = settings.commitPrefix ? settings.commitPrefix + ' ' : '';
    return `${prefix}chore(design): update Figma variables (${vars} vars, ${cols} collections) - ${ts}`;
  };

  const jsonPreview = exportState.data ? stableStringify(exportState.data, 2) : '';

  return (
    <div style={{ padding: 12, fontFamily: 'Inter, sans-serif' }}>
      {/* Network status indicator */}
      {!isOnline && (
        <div
          style={{
            background: 'var(--figma-color-bg-warning, #fff4e5)',
            border: '1px solid var(--figma-color-border-warning, #ffb020)',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '11px',
            color: 'var(--figma-color-text, #000)',
          }}
        >
          ⚠️ You are offline. GitHub operations are disabled.
        </div>
      )}

      <h3 style={{ marginTop: 0 }}>FigGit</h3>

      {!settings && <LoadingState message="Loading settings..." />}

      {settings && (
        <>
          {/* Repository Settings */}
          <section style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Repository</h4>
            <TextInput
              label="Owner"
              value={settings.owner}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ owner: e.target.value })
              }
            />
            <TextInput
              label="Repo"
              value={settings.repo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ repo: e.target.value })
              }
            />
            <TextInput
              label="Branch"
              value={settings.branch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ branch: e.target.value })
              }
            />
            <TextInput
              label="Folder (optional)"
              value={settings.folder}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ folder: e.target.value })
              }
            />
            <TextInput
              label="Filename"
              value={settings.filename}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ filename: e.target.value })
              }
            />
            <TextInput
              label="Commit Prefix (optional)"
              value={settings.commitPrefix || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ commitPrefix: e.target.value })
              }
            />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <input
                type="checkbox"
                id="dryRun"
                checked={!!settings.dryRun}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateSettings({ dryRun: e.target.checked })
                }
              />
              <label htmlFor="dryRun" style={{ marginLeft: 6, fontSize: '12px' }}>
                Dry run (no commit)
              </label>
            </div>
            <div style={{ marginTop: 8 }}>
              <Button onClick={handleSaveSettings} disabled={!settings.owner || !settings.repo}>
                Save Settings
              </Button>
            </div>
          </section>

          {/* GitHub Token */}
          <section style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '8px 0' }}>GitHub Token</h4>
            {tokenPresent ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--figma-color-text-success, green)' }}>
                  Token stored
                </div>
                <Button variant="secondary" onClick={handleClearToken}>
                  Clear Token
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleValidateToken}
                  disabled={tokenValidation.status === 'checking' || !isOnline}
                >
                  {tokenValidation.status === 'checking' ? 'Validating…' : 'Validate'}
                </Button>
                {tokenValidation.status === 'valid' && (
                  <span style={{ fontSize: 11, color: 'var(--figma-color-text-success, #2d7b2d)' }}>
                    ✔ {tokenValidation.login}
                  </span>
                )}
                {tokenValidation.status === 'invalid' && (
                  <span style={{ fontSize: 11, color: 'var(--figma-color-text-danger, #b00020)' }}>
                    Invalid
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  style={{ flex: 1 }}
                  type="password"
                  placeholder="ghp_..."
                  value={tokenInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateTokenInput(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tokenInput.trim()) {
                      handleSaveToken();
                    }
                  }}
                />
                <Button onClick={handleSaveToken} disabled={!tokenInput.trim()}>
                  Save
                </Button>
              </div>
            )}
          </section>

          {/* Export */}
          <section style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '8px 0' }}>
              Export{' '}
              <span style={{ fontSize: '10px', color: 'var(--figma-color-text-secondary, #999)' }}>
                (⌘E)
              </span>
            </h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={handleExport} disabled={exportState.loading}>
                Export Variables
              </Button>
              <Button variant="secondary" onClick={togglePreview} disabled={!exportState.data}>
                {previewCollapsed ? 'Show Preview' : 'Hide Preview'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleRequestDiff}
                disabled={!exportState.data || !isOnline}
              >
                Diff
              </Button>
            </div>

            {exportState.loading && (
              <LoadingState message="Exporting variables..." submessage="Reading Figma file..." />
            )}

            {exportState.error && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--figma-color-text-danger, red)',
                  marginTop: 6,
                }}
              >
                {exportState.error}
              </div>
            )}

            {exportState.data && !previewCollapsed && (
              <pre
                style={{
                  maxHeight: 200,
                  overflow: 'auto',
                  background: 'var(--figma-color-bg-secondary, #f5f5f5)',
                  padding: 8,
                  marginTop: 8,
                  fontSize: 11,
                  borderRadius: 4,
                }}
              >
                {jsonPreview}
              </pre>
            )}

            {exportState.data && (
              <div style={{ marginTop: 6 }}>
                <Button variant="secondary" onClick={handleCopyJson}>
                  Copy JSON
                </Button>
              </div>
            )}

            {/* Diff View */}
            {diffOpen && diff && (
              <div
                style={{
                  marginTop: 10,
                  border: '1px solid var(--figma-color-border, #ddd)',
                  padding: 8,
                  background: 'var(--figma-color-bg-secondary, #fafafa)',
                  borderRadius: 4,
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <strong style={{ fontSize: 12 }}>Diff vs Remote</strong>
                  <Button variant="secondary" onClick={() => setDiffOpen(false)}>
                    Close
                  </Button>
                </div>

                {!diff.ready && (
                  <LoadingState
                    message="Fetching remote file..."
                    submessage="Comparing changes..."
                  />
                )}

                {diff.ready && diff.error && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--figma-color-text-danger, red)',
                      marginTop: 4,
                    }}
                  >
                    {diff.error}
                  </div>
                )}

                {diff.ready && !diff.error && diff.empty && (
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    No remote file found (all additions if you commit).
                  </div>
                )}

                {diff.ready && !diff.error && !diff.empty && (
                  <div style={{ marginTop: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        marginBottom: 4,
                        color: 'var(--figma-color-text-secondary, #666)',
                      }}
                    >
                      {diff.counts.addedVariables} added vars · {diff.counts.removedVariables}{' '}
                      removed vars · {diff.counts.changedVariables} changed vars
                      <br />
                      {diff.counts.addedCollections} added collections ·{' '}
                      {diff.counts.removedCollections} removed collections ·{' '}
                      {diff.counts.renamedCollections} renamed collections
                    </div>
                    <div
                      style={{
                        maxHeight: 160,
                        overflow: 'auto',
                        fontSize: 11,
                      }}
                    >
                      {diff.addedCollections.length > 0 && (
                        <div>
                          <strong>+ Collections</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {diff.addedCollections.map((c) => (
                              <li key={c.id}>+ {c.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.removedCollections.length > 0 && (
                        <div>
                          <strong>- Collections</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {diff.removedCollections.map((c) => (
                              <li
                                key={c.id}
                                style={{ color: 'var(--figma-color-text-danger, #b00020)' }}
                              >
                                - {c.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.renamedCollections.length > 0 && (
                        <div>
                          <strong>~ Collections</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {diff.renamedCollections.map((c) => (
                              <li key={c.id}>
                                ~ {c.before} → {c.after}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.addedVariables.length > 0 && (
                        <div>
                          <strong>+ Variables</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {diff.addedVariables.map((v) => (
                              <li key={v.id}>+ {v.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.removedVariables.length > 0 && (
                        <div>
                          <strong>- Variables</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {diff.removedVariables.map((v) => (
                              <li
                                key={v.id}
                                style={{ color: 'var(--figma-color-text-danger, #b00020)' }}
                              >
                                - {v.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.changedVariables.length > 0 && (
                        <div>
                          <strong>~ Variables</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {diff.changedVariables.map((v) => (
                              <li key={v.id}>
                                ~{' '}
                                {v.nameBefore !== v.nameAfter
                                  ? `${v.nameBefore} → ${v.nameAfter}`
                                  : v.nameAfter}{' '}
                                {v.changedModes.length > 0 && (
                                  <span
                                    style={{ color: 'var(--figma-color-text-secondary, #555)' }}
                                  >
                                    ({v.changedModes.length} modes)
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.counts.addedVariables === 0 &&
                        diff.counts.removedVariables === 0 &&
                        diff.counts.changedVariables === 0 &&
                        diff.counts.addedCollections === 0 &&
                        diff.counts.removedCollections === 0 &&
                        diff.counts.renamedCollections === 0 && <div>No differences.</div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Commit */}
          <section style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '8px 0' }}>
              Commit{' '}
              <span style={{ fontSize: '10px', color: 'var(--figma-color-text-secondary, #999)' }}>
                (⌘↩)
              </span>
            </h4>
            <div
              style={{
                fontSize: 11,
                marginBottom: 4,
                color: 'var(--figma-color-text-secondary, #666)',
              }}
            >
              Commit message preview:
              <br />
              <code
                style={{
                  fontSize: 11,
                  background: 'var(--figma-color-bg-secondary, #f0f0f0)',
                  padding: '2px 4px',
                  borderRadius: 2,
                }}
              >
                {buildCommitMessagePreview()}
              </code>
            </div>
            <Button
              onClick={handleCommit}
              disabled={!exportState.data || commitState.inProgress || !tokenPresent || !isOnline}
            >
              {commitState.inProgress
                ? 'Committing…'
                : settings.dryRun
                  ? 'Dry Run'
                  : 'Commit to GitHub'}
            </Button>

            {commitState.inProgress && (
              <LoadingState
                message="Committing to GitHub..."
                submessage="Uploading to repository..."
              />
            )}

            {commitState.error && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--figma-color-text-danger, red)',
                  marginTop: 6,
                }}
              >
                {commitState.error}
              </div>
            )}

            {commitState.success && commitState.skipped && (
              <div
                style={{
                  fontSize: 12,
                  marginTop: 6,
                  color: 'var(--figma-color-text-secondary, #666)',
                }}
              >
                Skipped (no changes)
              </div>
            )}

            {commitState.success && !commitState.skipped && (
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Committed{' '}
                {commitState.url && (
                  <a
                    href={commitState.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--figma-color-text-brand, #18A0FB)' }}
                  >
                    view
                  </a>
                )}{' '}
              </div>
            )}
          </section>
        </>
      )}

      {/* Toast Notifications */}
      <ToastContainer notifications={notifications} onDismiss={dismiss} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <PluginProvider>
        <AppContent />
      </PluginProvider>
    </ErrorBoundary>
  );
};

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  console.error('Root element not found!');
}
