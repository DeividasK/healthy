import React, { useCallback, useState, type SetStateAction } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import type { AddOptionItem } from './AddOptionsModal';
import {
  addOptionalField,
  hiddenOptionalFields,
  initOptionalFields,
  loadOptionalFields,
  removeOptionalField,
  setOptionalField,
  type OptionalFieldSpec,
} from './optionalFields';
import { COLORS } from '@/src/theme/colors';

/** An optional form field and its `+` menu option. */
export interface OptionalFieldConfig<V> extends OptionalFieldSpec<V> {
  label: string;
  icon: LucideIcon;
  /** Test ID of the menu option; defaults to the prefix and the field id. */
  testID?: string;
}

/**
 * Optional fields for a form: each field's value and visibility, the `+`
 * menu options for hidden fields, and removal that clears a field and
 * returns it to the menu. Fields are declared in the order the menu lists
 * them; render each with `FormField`'s `onRemove` set to `remove(id)`.
 */
export function useOptionalFields<T extends Record<string, unknown>>(
  configs: { [K in keyof T]: OptionalFieldConfig<T[K]> },
  { testIDPrefix = 'menu-add-' }: { testIDPrefix?: string } = {}
) {
  const [state, setState] = useState(() => initOptionalFields(configs));
  // Stable for effects that load stored values; empty values never change.
  const [initialConfigs] = useState(configs);
  const load = useCallback(
    (loaded: Partial<T>) =>
      setState((current) =>
        loadOptionalFields(current, initialConfigs, loaded)
      ),
    [initialConfigs]
  );

  const set = <K extends keyof T>(id: K, value: SetStateAction<T[K]>) =>
    setState((current) =>
      setOptionalField(
        current,
        id,
        typeof value === 'function'
          ? (value as (previous: T[K]) => T[K])(current.values[id])
          : value
      )
    );

  const menuOptions: AddOptionItem[] = hiddenOptionalFields(state, configs).map(
    (id) => {
      const { label, icon: Icon, testID } = configs[id];
      return {
        id: String(id),
        label,
        testID: testID ?? `${testIDPrefix}${String(id)}`,
        icon: (
          <Icon
            color={COLORS.light.primary}
            size={20}
            style={{ marginRight: 12 }}
          />
        ),
        onPress: () =>
          setState((current) => addOptionalField(current, configs, id)),
      };
    }
  );

  return {
    values: state.values,
    shown: state.shown,
    /** Field ids in declaration order, for forms that render them in a loop. */
    order: Object.keys(configs) as (keyof T)[],
    labels: Object.fromEntries(
      Object.entries(configs).map(([id, config]) => [id, config.label])
    ) as Record<keyof T, string>,
    set,
    /** Hides a field and clears its value. */
    remove: (id: keyof T) =>
      setState((current) => removeOptionalField(current, configs, id)),
    /** Applies stored values that loaded after the form opened. */
    load,
    menuOptions,
  };
}
