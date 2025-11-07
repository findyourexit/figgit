/**
 * Plugin communication context for centralized message handling.
 *
 * Provides a Preact Context to eliminate props drilling and centralize
 * all postMessage communication between the UI and plugin sandbox.
 */

import { h, FunctionComponent, createContext } from 'preact';
import { useContext, useState, useEffect, useCallback } from 'preact/hooks';
import { UIToPluginMessage, PluginToUIMessage, PersistedSettings } from '../../messaging';
import { ExportRoot } from '../../shared/types';
import { DtcgRoot } from '../../shared/dtcg-types';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ExportState {
  loading: boolean;
  data?: ExportRoot | DtcgRoot;
  error?: string;
}

export interface CommitState {
  inProgress: boolean;
  success: boolean;
  skipped: boolean;
  url?: string;
  error?: string;
}

export interface RemoteDataState {
  loading: boolean;
  /** Data from remote file. undefined = not fetched, null = fetched but doesn't exist, object = exists */
  data?: ExportRoot | DtcgRoot | null;
  error?: string;
  /** Whether a fetch has been attempted (helps distinguish undefined from never-fetched) */
  fetched?: boolean;
}

interface PluginContextType {
  sendMessage: (message: UIToPluginMessage) => void;
  notify: (type: NotificationType, message: string) => void;
  settings: PersistedSettings | null;
  tokenPresent: boolean;
  updateSettings: (partial: Partial<PersistedSettings>) => void;

  // Export state
  exportState: ExportState;
  startExport: () => void;

  // Commit state
  commitState: CommitState;
  startCommit: (exportData: ExportRoot | DtcgRoot, dryRun?: boolean, commitPrefix?: string) => void;
  resetCommit: () => void;

  // Remote data state
  remoteDataState: RemoteDataState;
  fetchRemoteData: () => void;
}

const PluginContext = createContext<PluginContextType | undefined>(undefined);

/**
 * Hook to access plugin communication context.
 *
 * Must be used within a PluginProvider.
 */
export function usePlugin() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugin must be used within a PluginProvider');
  }
  return context;
}

interface PluginProviderProps {
  children: preact.ComponentChildren;
}

/**
 * Provider component for plugin communication context.
 *
 * Wraps the app and provides centralized message sending and state management.
 */
export const PluginProvider: FunctionComponent<PluginProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [tokenPresent, setTokenPresent] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ loading: false });
  const [commitState, setCommitState] = useState<CommitState>({
    inProgress: false,
    success: false,
    skipped: false,
  });
  const [remoteDataState, setRemoteDataState] = useState<RemoteDataState>({ loading: false });

  const sendMessage = (message: UIToPluginMessage) => {
    parent.postMessage({ pluginMessage: message }, '*');
  };

  const notify = (type: NotificationType, message: string) => {
    // Map notification type to Figma's level
    const level = type === 'success' || type === 'info' ? 'info' : 'error';

    // Send notification message to plugin
    parent.postMessage(
      {
        pluginMessage: {
          type: 'NOTIFY',
          level,
          message,
        },
      },
      '*'
    );
  };

  const updateSettings = useCallback((partial: Partial<PersistedSettings>) => {
    setSettings((prev) => {
      if (!prev) return null;
      return { ...prev, ...partial };
    });
  }, []);

  const startExport = useCallback(() => {
    setExportState({ loading: true });
    sendMessage({ type: 'REQUEST_EXPORT' });
  }, []);

  const startCommit = useCallback(
    (exportData: ExportRoot | DtcgRoot, dryRun = false, commitPrefix = '') => {
      setCommitState({ inProgress: true, success: false, skipped: false });
      sendMessage({
        type: 'COMMIT_REQUEST',
        exportData,
        dryRun,
        commitPrefix,
      });
    },
    []
  );

  const resetCommit = useCallback(() => {
    setCommitState({ inProgress: false, success: false, skipped: false });
  }, []);

  const fetchRemoteData = useCallback(() => {
    setRemoteDataState({ loading: true });
    sendMessage({ type: 'FETCH_REMOTE_EXPORT' });
  }, []);

  // Listen for messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginToUIMessage;
      if (!msg) return;

      if (msg.type === 'SETTINGS_RESPONSE') {
        setSettings(msg.payload);
        setTokenPresent(msg.payload.tokenPresent);
      }

      if (msg.type === 'EXPORT_RESULT') {
        if (msg.ok) {
          setExportState({ loading: false, data: msg.data });
        } else {
          setExportState({ loading: false, error: msg.error });
          notify('error', `Export failed: ${msg.error}`);
        }
      }

      if (msg.type === 'COMMIT_RESULT') {
        if (msg.ok) {
          setCommitState({
            inProgress: false,
            success: true,
            skipped: msg.skipped || false,
            url: msg.url,
          });
          if (msg.skipped) {
            notify('info', 'No changes detected - commit skipped');
          } else {
            notify('success', 'Successfully committed to GitHub!');
            // Invalidate remote data cache after successful commit
            // This ensures the diff viewer will re-fetch and show correct state
            setRemoteDataState({ loading: false, fetched: false });
          }
        } else {
          setCommitState({
            inProgress: false,
            success: false,
            skipped: false,
            error: msg.error,
          });
          notify('error', `Commit failed: ${msg.error}`);
        }
      }

      if (msg.type === 'FETCH_REMOTE_EXPORT_RESULT') {
        if (msg.ok) {
          setRemoteDataState({ loading: false, data: msg.data, fetched: true });
        } else {
          // Don't show notification for fetch errors - let the component handle display
          setRemoteDataState({ loading: false, error: msg.error, fetched: true });
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Request settings on mount
    sendMessage({ type: 'REQUEST_SETTINGS' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-export when settings are loaded (eliminates UX friction)
  useEffect(() => {
    if (settings && !exportState.loading && !exportState.data && !exportState.error) {
      // Start export automatically in the background
      setTimeout(() => {
        setExportState({ loading: true });
        sendMessage({ type: 'REQUEST_EXPORT' });
      }, 100);
    }
  }, [settings, exportState.data, exportState.loading, exportState.error]);

  return (
    <PluginContext.Provider
      value={{
        sendMessage,
        notify,
        settings,
        tokenPresent,
        updateSettings,
        exportState,
        startExport,
        commitState,
        startCommit,
        resetCommit,
        remoteDataState,
        fetchRemoteData,
      }}
    >
      {children}
    </PluginContext.Provider>
  );
};
