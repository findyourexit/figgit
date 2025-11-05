/**
 * Custom hook for managing GitHub authentication.
 *
 * Handles token storage, validation, and authentication state.
 */

import { useState, useCallback } from 'react';

export interface TokenValidationState {
  status: 'idle' | 'valid' | 'invalid' | 'checking';
  login?: string;
  error?: string;
}

export function useGitHub() {
  const [tokenInput, setTokenInput] = useState('');
  const [tokenValidation, setTokenValidation] = useState<TokenValidationState>({
    status: 'idle',
  });

  const updateTokenInput = useCallback((value: string) => {
    setTokenInput(value);
  }, []);

  const clearTokenInput = useCallback(() => {
    setTokenInput('');
  }, []);

  const setValidationChecking = useCallback(() => {
    setTokenValidation({ status: 'checking' });
  }, []);

  const setValidationValid = useCallback((login: string) => {
    setTokenValidation({ status: 'valid', login });
  }, []);

  const setValidationInvalid = useCallback((error?: string) => {
    setTokenValidation({ status: 'invalid', error });
  }, []);

  const resetValidation = useCallback(() => {
    setTokenValidation({ status: 'idle' });
  }, []);

  return {
    tokenInput,
    tokenValidation,
    updateTokenInput,
    clearTokenInput,
    setValidationChecking,
    setValidationValid,
    setValidationInvalid,
    resetValidation,
  };
}
