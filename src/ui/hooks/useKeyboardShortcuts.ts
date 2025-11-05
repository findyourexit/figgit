/**
 * Custom hook for handling keyboard shortcuts.
 *
 * Supports common plugin actions:
 * - Cmd/Ctrl + Enter: Trigger commit
 * - Cmd/Ctrl + E: Export variables
 * - Escape: Close plugin or cancel operations
 */

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onCommit?: () => void;
  onExport?: () => void;
  onClose?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Enter - Commit
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handlers.onCommit?.();
        return;
      }

      // Cmd/Ctrl + E - Export
      if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
        event.preventDefault();
        handlers.onExport?.();
        return;
      }

      // Escape - Close/Cancel
      if (event.key === 'Escape') {
        event.preventDefault();
        handlers.onClose?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers]);
}
