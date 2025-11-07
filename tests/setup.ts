import '@testing-library/jest-dom';

// Mock window.parent.postMessage for plugin communication tests
(window as any).parent = {
  postMessage: (_message: any, _targetOrigin: string) => {
    // Mock implementation for tests
  },
};
