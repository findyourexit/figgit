/**
 * Loading indicator component for operations in progress.
 *
 * Shows what's happening during long-running operations like
 * exports, commits, and fetching remote data.
 */

import React from 'react';

interface LoadingStateProps {
  message: string;
  submessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message, submessage }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        fontSize: '12px',
        color: 'var(--figma-color-text-secondary, #666)',
      }}
    >
      <div
        style={{
          width: '12px',
          height: '12px',
          border: '2px solid var(--figma-color-border, #ccc)',
          borderTopColor: 'var(--figma-color-border-brand, #18A0FB)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <div>
        <div>{message}</div>
        {submessage && (
          <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.7 }}>{submessage}</div>
        )}
      </div>
      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};
