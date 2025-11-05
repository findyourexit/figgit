/**
 * Custom hook for managing toast notifications.
 *
 * Provides a simple interface for showing temporary notifications
 * with automatic dismissal after 5 seconds.
 */

import { useState, useCallback } from 'react';

export interface Notification {
  id: number;
  level: 'info' | 'error';
  message: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nextId, setNextId] = useState(1);

  const notify = useCallback(
    (level: 'info' | 'error', message: string) => {
      const id = nextId;
      setNotifications((prev) => [...prev, { id, level, message }]);
      setNextId((prev) => prev + 1);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    },
    [nextId]
  );

  const dismiss = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    notify,
    dismiss,
    clearAll,
  };
}
