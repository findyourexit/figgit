/**
 * Custom hook for managing plugin settings.
 *
 * Handles settings persistence and provides methods for
 * updating individual settings fields.
 */

import { useState, useCallback } from 'react';
import { PersistedSettings } from '../../messaging';

export function useSettings() {
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [tokenPresent, setTokenPresent] = useState(false);

  const updateSettings = useCallback((partial: Partial<PersistedSettings>) => {
    setSettings((prev) => {
      if (!prev) return null;
      return { ...prev, ...partial };
    });
  }, []);

  const loadSettings = useCallback(
    (loadedSettings: PersistedSettings & { tokenPresent: boolean }) => {
      setSettings(loadedSettings);
      setTokenPresent(loadedSettings.tokenPresent);
    },
    []
  );

  return {
    settings,
    tokenPresent,
    updateSettings,
    loadSettings,
    setTokenPresent,
  };
}
