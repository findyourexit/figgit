/**
 * Custom hook for managing variable export state.
 *
 * Handles export operations, preview state, and diff comparisons
 * with remote repository.
 */

import { useState, useCallback } from 'react';
import { ExportRoot } from '../../shared/types';

export interface ExportState {
  loading: boolean;
  data?: ExportRoot;
  error?: string;
}

export function useExport() {
  const [exportState, setExportState] = useState<ExportState>({ loading: false });
  const [previewCollapsed, setPreviewCollapsed] = useState(true);

  const startExport = useCallback(() => {
    setExportState({ loading: true });
  }, []);

  const exportSuccess = useCallback((data: ExportRoot) => {
    setExportState({ loading: false, data });
  }, []);

  const exportError = useCallback((error: string) => {
    setExportState({ loading: false, error });
  }, []);

  const resetExport = useCallback(() => {
    setExportState({ loading: false });
  }, []);

  const togglePreview = useCallback(() => {
    setPreviewCollapsed((prev) => !prev);
  }, []);

  return {
    exportState,
    previewCollapsed,
    startExport,
    exportSuccess,
    exportError,
    resetExport,
    togglePreview,
    setPreviewCollapsed,
  };
}
