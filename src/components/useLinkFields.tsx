import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { AddOptionItem } from './AddOptionsModal';
import type { AutocompleteItem } from './AutocompleteDropdown';
import { LinkedResourcesField } from './LinkedResourcesField';
import { NativeSelect } from './NativeSelect';
import type { NativeSelectOption } from './NativeSelect.types';
import { COLORS } from '@/src/theme/colors';

/** One kind of resource an edit form can link to. */
export interface LinkFieldConfig {
  /** Resource name used in test IDs, e.g. `treatment`. */
  type: string;
  /** Field label, e.g. `Treatments`. */
  label: string;
  icon: LucideIcon;
  options: AutocompleteItem[];
  initialIds: string[];
  /** How each link is recorded, chosen per link with a native select. */
  roles?: {
    options: NativeSelectOption[];
    initial: Record<string, string>;
    defaultRole: string;
  };
}

export interface LinkSelection {
  ids: string[];
  roles: Record<string, string>;
}

/**
 * Link fields for an edit form: `+` menu options for hidden fields, the
 * rendered fields, and the current selections keyed by resource type.
 */
export function useLinkFields(configs: LinkFieldConfig[]) {
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(configs.map((c) => [c.type, c.initialIds]))
  );
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(configs.map((c) => [c.type, c.initialIds.length > 0]))
  );
  const [roles, setRoles] = useState<Record<string, Record<string, string>>>(
    () =>
      Object.fromEntries(configs.map((c) => [c.type, c.roles?.initial || {}]))
  );

  const menuOptions: AddOptionItem[] = configs
    .filter((config) => !visible[config.type] && config.options.length > 0)
    .map(({ type, label, icon: Icon }) => ({
      id: `link-${type}`,
      label,
      testID: `menu-link-${type}`,
      icon: (
        <Icon
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      onPress: () => setVisible((current) => ({ ...current, [type]: true })),
    }));

  const fields = configs.map((config) => {
    if (!visible[config.type]) return null;
    const ids = selected[config.type] || [];
    const typeRoles = roles[config.type] || {};
    return (
      <LinkedResourcesField
        key={config.type}
        label={config.label}
        searchLabel={`Link ${config.label.toLowerCase()}`}
        options={config.options}
        selectedIds={ids}
        onChange={(next) =>
          setSelected((current) => ({ ...current, [config.type]: next }))
        }
        itemType={config.type}
        idPrefix="link-"
        testID={`link-${config.type}-field`}
        removeTestID={`remove-link-${config.type}-button`}
        onRemove={() => {
          setVisible((current) => ({ ...current, [config.type]: false }));
          setSelected((current) => ({ ...current, [config.type]: [] }));
        }}
        renderItemControl={
          config.roles &&
          ((id) => (
            <View style={styles.role}>
              <NativeSelect
                testID={`link-${config.type}-role-${id}`}
                name={`${config.type}Role-${id}`}
                label={`Link role for ${
                  config.options.find((option) => option.id === id)?.label || id
                }`}
                value={typeRoles[id] || config.roles!.defaultRole}
                options={config.roles!.options}
                onChange={(role) =>
                  setRoles((current) => ({
                    ...current,
                    [config.type]: { ...current[config.type], [id]: role },
                  }))
                }
              />
            </View>
          ))
        }
      />
    );
  });

  const values: Record<string, LinkSelection> = Object.fromEntries(
    configs.map((config) => {
      const ids = selected[config.type] || [];
      const typeRoles = roles[config.type] || {};
      return [
        config.type,
        {
          ids,
          roles: Object.fromEntries(
            ids.map((id) => [
              id,
              typeRoles[id] || config.roles?.defaultRole || '',
            ])
          ),
        },
      ];
    })
  );

  return { menuOptions, fields, values };
}

const styles = StyleSheet.create({
  role: {
    minWidth: 150,
  },
});

/** Links added and removed between the form's start and its submission. */
export function diffLinkIds(before: string[], after: string[]) {
  return {
    added: after.filter((id) => !before.includes(id)),
    removed: before.filter((id) => !after.includes(id)),
  };
}
