import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type DatabaseTable =
  | 'patients'
  | 'conditions'
  | 'diagnostic_reports'
  | 'observations'
  | 'app_settings';

type Listener = (tables: DatabaseTable[]) => void;

const listeners = new Set<Listener>();

const BROADCAST_CHANNEL_NAME = 'healthy_db_channel';
let channel: BroadcastChannel | null = null;

if (Platform.OS === 'web' && typeof BroadcastChannel !== 'undefined') {
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.tables && Array.isArray(event.data.tables)) {
        emitToListeners(event.data.tables, false);
      }
    };
  } catch (err) {
    console.warn('Failed to initialize cross-tab BroadcastChannel:', err);
  }
}

function emitToListeners(tables: DatabaseTable[], broadcast = true) {
  listeners.forEach((listener) => {
    try {
      listener(tables);
    } catch (err) {
      console.error('Error in database change listener:', err);
    }
  });

  if (broadcast && channel) {
    try {
      channel.postMessage({ tables });
    } catch (err) {
      console.warn('Failed to broadcast db change across tabs:', err);
    }
  }
}

/**
 * Notifies all in-memory subscribers and (on Web) other browser tabs that the specified database tables were updated.
 */
export function notifyDatabaseChanged(tables: DatabaseTable[]): void {
  emitToListeners(tables, true);
}

/**
 * Subscribes to database changes for one or more tables.
 * Triggers the provided callback whenever any of the specified tables are modified locally,
 * via background sync, or on another browser tab.
 */
export function useDatabaseSubscription(
  tables: DatabaseTable[],
  callback: (changedTables: DatabaseTable[]) => void
): void {
  const tablesRef = useRef(tables);
  const callbackRef = useRef(callback);

  useEffect(() => {
    tablesRef.current = tables;
    callbackRef.current = callback;
  });

  useEffect(() => {
    const listener: Listener = (changedTables) => {
      const watched = tablesRef.current;
      const hasIntersection = changedTables.some((t) => watched.includes(t));
      if (hasIntersection) {
        callbackRef.current(changedTables);
      }
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
