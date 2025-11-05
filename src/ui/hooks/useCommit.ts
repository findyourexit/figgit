/**
 * Custom hook for managing GitHub commit operations.
 *
 * Tracks commit state including loading, success, and error states.
 */

import { useState, useCallback } from 'react';

export interface CommitState {
  inProgress: boolean;
  success?: boolean;
  skipped?: boolean;
  error?: string;
  url?: string;
}

export function useCommit() {
  const [commitState, setCommitState] = useState<CommitState>({ inProgress: false });

  const startCommit = useCallback(() => {
    setCommitState({ inProgress: true });
  }, []);

  const commitSuccess = useCallback((skipped: boolean, url?: string) => {
    setCommitState({ inProgress: false, success: true, skipped, url });
  }, []);

  const commitError = useCallback((error: string) => {
    setCommitState({ inProgress: false, error });
  }, []);

  const resetCommit = useCallback(() => {
    setCommitState({ inProgress: false });
  }, []);

  return {
    commitState,
    startCommit,
    commitSuccess,
    commitError,
    resetCommit,
  };
}
