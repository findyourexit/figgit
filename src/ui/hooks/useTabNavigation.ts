/**
 * Custom hook for managing tab navigation and persistence.
 *
 * Handles tab state, keyboard shortcuts, and persistence to localStorage.
 */

import { useState, useCallback, useEffect } from 'preact/hooks';

const STORAGE_KEY = 'figgit:activeTab';

export type TabId = 'settings' | 'preview' | 'export';

export function useTabNavigation(defaultTab: TabId = 'export') {
  // Load persisted tab or use default
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ['settings', 'preview', 'export'].includes(stored)) {
        return stored as TabId;
      }
    } catch (error) {
      console.warn('Failed to load active tab from localStorage:', error);
    }
    return defaultTab;
  });

  // Persist tab changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, activeTab);
    } catch (error) {
      console.warn('Failed to save active tab to localStorage:', error);
    }
  }, [activeTab]);

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab);
  }, []);

  const goToSettings = useCallback(() => setActiveTab('settings'), [setActiveTab]);
  const goToPreview = useCallback(() => setActiveTab('preview'), [setActiveTab]);
  const goToExport = useCallback(() => setActiveTab('export'), [setActiveTab]);

  return {
    activeTab,
    setActiveTab,
    goToSettings,
    goToPreview,
    goToExport,
  };
}
