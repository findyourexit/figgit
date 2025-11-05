import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.parent.postMessage for plugin communication tests
(window as any).parent = {
  postMessage: (_message: any, _targetOrigin: string) => {
    // Mock implementation for tests
  },
};
