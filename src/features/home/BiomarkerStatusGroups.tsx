import type { Observation } from 'fhir/r5';
import { useContext, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { CountBadge } from '@/src/components/CountBadge';
import { COLORS } from '@/src/theme/colors';
import {
  RANGE_STATUS_LABELS,
  RANGE_STATUSES,
  type RangeStatus,
} from '@/src/features/lab-results/biomarkerMeasurements';
import {
  BiomarkerResultRow,
  BiomarkerSelectionContext,
  getBiomarkerRouteId,
} from './BiomarkerResultRow';

export type GroupedBiomarker = {
  id: string;
  observation: Observation;
  status?: RangeStatus;
};

/**
 * Biomarker rows under Out of range, In range and No range headings, each
 * with its count; empty groups are left out. Rows keep the given order.
 * Groups start collapsed, except while `expanded` (e.g. searching) and the
 * groups holding the biomarker chosen beside the list; a heading press
 * opens or closes its group.
 */
export function BiomarkerStatusGroups({
  biomarkers,
  testID,
  rowTestID,
  expanded = false,
}: {
  biomarkers: GroupedBiomarker[];
  testID: string;
  rowTestID?: (biomarker: GroupedBiomarker) => string;
  expanded?: boolean;
}) {
  const selection = useContext(BiomarkerSelectionContext);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const groups = [...RANGE_STATUSES, undefined]
    .map((status) => ({
      key: status ?? 'noRange',
      label: status ? RANGE_STATUS_LABELS[status] : 'No range',
      items: biomarkers.filter((biomarker) => biomarker.status === status),
    }))
    .filter(({ items }) => items.length > 0);
  const selectedGroup = groups.find(({ items }) =>
    items.some(
      ({ observation }) =>
        getBiomarkerRouteId(observation) === selection?.selectedId
    )
  )?.key;
  // Groups the selection has been in stay open when it moves on, so arrow
  // keys and related biomarkers do not fold rows away.
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  if (selectedGroup && !selectedGroups.includes(selectedGroup))
    setSelectedGroups([...selectedGroups, selectedGroup]);

  return (
    <View testID={testID}>
      {groups.map(({ key, label, items }) => {
        const isOpen =
          expanded ||
          (toggled[key] ??
            (key === selectedGroup || selectedGroups.includes(key)));
        return (
          <View key={key} style={styles.group} testID={`${testID}-${key}`}>
            <TouchableOpacity
              style={styles.heading}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${items.length} biomarkers`}
              aria-expanded={isOpen}
              disabled={expanded}
              activeOpacity={0.6}
              onPress={() =>
                setToggled((current) => ({ ...current, [key]: !isOpen }))
              }
              testID={`${testID}-${key}-toggle`}
            >
              <Text style={styles.title} accessibilityRole="header">
                {label}
              </Text>
              <CountBadge
                count={items.length}
                accessibilityLabel={`${label}: ${items.length} biomarkers`}
                testID={`${testID}-${key}-count`}
              />
              {!expanded && (
                <View
                  style={[styles.chevron, isOpen && styles.chevronExpanded]}
                >
                  <ChevronDown color={COLORS.light.muted} size={18} />
                </View>
              )}
            </TouchableOpacity>
            {isOpen &&
              items.map((biomarker) => (
                <BiomarkerResultRow
                  key={biomarker.id}
                  observation={biomarker.observation}
                  testID={rowTestID?.(biomarker)}
                />
              ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Closes the last row with the same full-width hairline.
  group: {
    marginTop: 24,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  // Spans the group, so pressing anywhere on the heading line toggles it.
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    marginBottom: 4,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  // Lines up with the chevrons of the rows.
  chevron: { marginLeft: 'auto' },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },
});
