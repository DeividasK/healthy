import type { Observation } from 'fhir/r5';
import { useContext, useState } from 'react';
import { View } from 'react-native';
import { CountBadge } from '@/src/components/CountBadge';
import { FoldingSection } from '@/src/components/FoldingSection';
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
          <FoldingSection
            key={key}
            title={label}
            isOpen={isOpen}
            accessibilityLabel={`${label}: ${items.length} biomarkers`}
            disabled={expanded}
            onToggle={() =>
              setToggled((current) => ({ ...current, [key]: !isOpen }))
            }
            badge={
              <CountBadge
                count={items.length}
                accessibilityLabel={`${label}: ${items.length} biomarkers`}
                testID={`${testID}-${key}-count`}
              />
            }
            testID={`${testID}-${key}`}
          >
            {items.map((biomarker) => (
              <BiomarkerResultRow
                key={biomarker.id}
                observation={biomarker.observation}
                testID={rowTestID?.(biomarker)}
              />
            ))}
          </FoldingSection>
        );
      })}
    </View>
  );
}
