import React from 'react';
import { CircleDot, ListFilter } from 'lucide-react-native';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import {
  FilterChip,
  FilterDot,
  FilterGroup,
  FilterGroups,
  toggleFilter,
} from '@/src/components/FilterControls';
import {
  getCurrentUsageLabel,
  type CurrentUsage,
} from '@/src/features/actions/treatmentUsage';
import { TIMELINE_TONES } from '@/src/features/conditions/timelineAppearance';
import type { StatusTone } from '@/src/features/conditions/conditionTimeline';

/** The order statuses are offered in. */
export const USAGE_FILTERS: CurrentUsage[] = [
  'taking',
  'on-hold',
  'stopped',
  'not-started',
];

/** Each current usage's status colours, matching the condition timeline. */
export const USAGE_TONES: Record<CurrentUsage, StatusTone> = {
  taking: 'active',
  'on-hold': 'paused',
  stopped: 'done',
  'not-started': 'planned',
};

/**
 * Filters the treatments list by current usage. Changes apply as they are
 * made; no status selected means all.
 */
export function TreatmentFilterModal({
  visible,
  statuses,
  onChange,
  onClose,
}: {
  visible: boolean;
  statuses: CurrentUsage[];
  onChange: (statuses: CurrentUsage[]) => void;
  onClose: () => void;
}) {
  return (
    <CenteredModal
      visible={visible}
      title="Filter treatments"
      icon={ListFilter}
      onClose={onClose}
      testID="treatments-filters"
    >
      <FilterGroups>
        <FilterGroup icon={CircleDot} label="Status" chips>
          {USAGE_FILTERS.map((usage) => {
            const tone = TIMELINE_TONES[USAGE_TONES[usage]];
            return (
              <FilterChip
                key={usage}
                label={getCurrentUsageLabel(usage)}
                selected={statuses.includes(usage)}
                testID={`treatments-filter-status-${usage}`}
                onPress={() => onChange(toggleFilter(statuses, usage))}
              >
                <FilterDot color={tone.node} borderColor={tone.icon} />
              </FilterChip>
            );
          })}
        </FilterGroup>
      </FilterGroups>
      <ModalActions>
        <ModalButton
          label="Reset"
          testID="treatments-filters-reset"
          onPress={() => onChange([])}
        />
        <ModalButton
          label="Done"
          tone="primary"
          testID="treatments-filters-done"
          onPress={onClose}
        />
      </ModalActions>
    </CenteredModal>
  );
}
