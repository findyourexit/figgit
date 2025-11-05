/**
 * Plugin communication context for centralized message handling.
 *
 * Provides a React Context to eliminate props drilling and centralize
 * all postMessage communication between the UI and plugin sandbox.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { UIToPluginMessage } from '../../messaging';

interface PluginContextType {
  sendMessage: (message: UIToPluginMessage) => void;
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
  children: ReactNode;
}

/**
 * Provider component for plugin communication context.
 *
 * Wraps the app and provides centralized message sending.
 */
export const PluginProvider: React.FC<PluginProviderProps> = ({ children }) => {
  const sendMessage = (message: UIToPluginMessage) => {
    parent.postMessage({ pluginMessage: message }, '*');
  };

  return <PluginContext.Provider value={{ sendMessage }}>{children}</PluginContext.Provider>;
};
