import React from 'react';
import { ArrowUpDown, Calendar, ListFilter } from 'lucide-react-native';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import { FilterGroup, FilterGroups } from '@/src/components/FilterControls';
import { NativeSelect } from '@/src/components/NativeSelect';
import { SUMMARY_SORT_OPTIONS, type SummarySort } from './labsSummarySorting';
import {
  DEFAULT_LABS_SUMMARY_FILTERS,
  PERIODS,
  type LabsSummaryFilters,
} from './labsSummaryFilters';

/**
 * Filters the latest results by time period and sorts them. Changes apply
 * as they are made.
 */
export function LabsSummaryFilterModal({
  visible,
  filters,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: LabsSummaryFilters;
  onChange: (filters: LabsSummaryFilters) => void;
  onClose: () => void;
}) {
  return (
    <CenteredModal
      visible={visible}
      title="Filter latest results"
      icon={ListFilter}
      onClose={onClose}
      testID="labs-summary-filters"
    >
      <FilterGroups>
        <FilterGroup icon={Calendar} label="Time period">
          <NativeSelect
            compact
            label="Time period"
            name="labs-summary-filter-period"
            testID="labs-summary-filter-period"
            value={filters.period}
            options={PERIODS}
            onChange={(period) => onChange({ ...filters, period })}
          />
        </FilterGroup>
        <FilterGroup icon={ArrowUpDown} label="Sort">
          <NativeSelect
            compact
            label="Sort"
            name="labs-summary-filter-sort"
            testID="labs-summary-filter-sort"
            value={filters.sort}
            options={[...SUMMARY_SORT_OPTIONS]}
            onChange={(sort) =>
              onChange({ ...filters, sort: sort as SummarySort })
            }
          />
        </FilterGroup>
      </FilterGroups>
      <ModalActions>
        <ModalButton
          label="Reset"
          testID="labs-summary-filters-reset"
          onPress={() => onChange(DEFAULT_LABS_SUMMARY_FILTERS)}
        />
        <ModalButton
          label="Done"
          tone="primary"
          testID="labs-summary-filters-done"
          onPress={onClose}
        />
      </ModalActions>
    </CenteredModal>
  );
}
