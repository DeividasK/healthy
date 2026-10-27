import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'healthy.filters.';

/**
 * A list's filters, remembered on this device only (never synced with the
 * profile). Each key is one filter instance, e.g. one profile's treatments
 * list or one condition's timeline, so choices never leak between them.
 * `parse` checks what was saved, returning null to fall back to `defaults`
 * (e.g. after an option was removed). Until the saved filters are read,
 * `isLoaded` is false so the list doesn't flash with the defaults.
 */
export function useSavedFilters<T>(
  key: string | null,
  defaults: T,
  parse: (saved: unknown) => T | null
): [T, (filters: T) => void, boolean] {
  const [state, setState] = useState<{ key: string | null; filters: T }>({
    key: null,
    filters: defaults,
  });

  useEffect(() => {
    if (!key) return;
    let current = true;
    const load = async () => {
      let filters = defaults;
      try {
        const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
        if (raw !== null) filters = parse(JSON.parse(raw)) ?? defaults;
      } catch (error) {
        console.warn('Failed to load saved filters:', error);
      }
      if (current) setState({ key, filters });
    };
    void load();
    return () => {
      current = false;
    };
    // `defaults` and `parse` are fixed per list; only a new key reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setFilters = useCallback(
    (filters: T) => {
      if (!key) return;
      setState({ key, filters });
      AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(filters)).catch(
        (error) => console.warn('Failed to save filters:', error)
      );
    },
    [key]
  );

  const isLoaded = !!key && state.key === key;
  return [isLoaded ? state.filters : defaults, setFilters, isLoaded];
}
