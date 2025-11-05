/**
 * Toast notification component with accessibility and animations.
 *
 * Provides visual feedback for user actions with:
 * - Auto-dismissal after 5 seconds
 * - Manual dismissal on click
 * - ARIA live regions for screen reader support
 * - Smooth animations
 */

import React from 'react';
import { Notification } from '../hooks';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: number) => void;
}

export const Toast: React.FC<ToastProps> = ({ notification, onDismiss }) => {
  const isError = notification.level === 'error';

  return (
    <div
      role="status"
      aria-live={isError ? 'assertive' : 'polite'}
      onClick={() => onDismiss(notification.id)}
      style={{
        background: isError
          ? 'var(--figma-color-bg-danger, #ffe6e6)'
          : 'var(--figma-color-bg-brand, #eef5ff)',
        border: `1px solid ${isError ? 'var(--figma-color-border-danger, #ff9090)' : 'var(--figma-color-border-brand, #91b4ff)'}`,
        color: 'var(--figma-color-text, #000)',
        padding: '8px 12px',
        fontSize: '11px',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        animation: 'slideIn 0.3s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      {notification.message}
    </div>
  );
};

interface ToastContainerProps {
  notifications: Notification[];
  onDismiss: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          bottom: '8px',
          left: '8px',
          right: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          pointerEvents: 'auto',
          zIndex: 1000,
        }}
      >
        {notifications.slice(-3).map((notification) => (
          <Toast key={notification.id} notification={notification} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
};
