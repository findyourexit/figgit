import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    // Reset error state and attempt to recover
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            maxWidth: '400px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--figma-color-text, #333)',
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--figma-color-text-secondary, #666)',
              marginBottom: '16px',
              lineHeight: '16px',
            }}
          >
            The plugin encountered an unexpected error. You can try resetting the plugin or
            reloading it from the Figma menu.
          </p>

          {this.state.error && (
            <details
              style={{
                marginBottom: '16px',
                textAlign: 'left',
                fontSize: '10px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  marginBottom: '8px',
                  color: 'var(--figma-color-text-secondary, #666)',
                }}
              >
                Error details
              </summary>
              <div
                className="code-block"
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--figma-color-bg-secondary, #f5f5f5)',
                  border: '1px solid var(--figma-color-border, #e0e0e0)',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                <strong>Error:</strong> {this.state.error.message}
                {this.state.errorInfo && (
                  <>
                    {'\n\n'}
                    <strong>Component Stack:</strong>
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </div>
            </details>
          )}

          <button className="button--primary" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
