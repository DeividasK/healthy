import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Calendar,
  CircleDot,
  ListFilter,
  Shapes,
  type LucideIcon,
} from 'lucide-react-native';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import { NativeSelect } from '@/src/components/NativeSelect';
import { COLORS } from '@/src/theme/colors';
import { TIMELINE_TONES, TIMELINE_TYPES } from './timelineAppearance';
import {
  NO_TIMELINE_FILTERS,
  type StatusTone,
  type TimelineFilters,
  type TimelineItem,
  type TimelinePeriod,
} from './conditionTimeline';

const TONE_LABELS: Record<StatusTone, string> = {
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  done: 'Done',
  faded: 'Cancelled',
};

const TYPE_LABELS: Record<TimelineItem['type'], string> = {
  consultation: 'Consultations',
  serviceRequest: 'Service requests',
  treatment: 'Treatments',
  labResult: 'Lab results',
};

const PERIODS: { id: TimelinePeriod; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past3', label: 'Past 3 months' },
  { id: 'past6', label: 'Past 6 months' },
  { id: 'past12', label: 'Past 12 months' },
];

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Filters the condition timeline by status tone, time period and step type.
 * Changes apply as they are made; no tone or type selected means all.
 */
export function TimelineFilterModal({
  visible,
  filters,
  types,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: TimelineFilters;
  /** Step types present on the timeline; only these can be picked. */
  types: TimelineItem['type'][];
  onChange: (filters: TimelineFilters) => void;
  onClose: () => void;
}) {
  return (
    <CenteredModal
      visible={visible}
      title="Filter timeline"
      icon={ListFilter}
      onClose={onClose}
      testID="condition-timeline-filters"
    >
      <View style={styles.groups}>
        <FilterGroup icon={CircleDot} label="Status" chips>
          {(Object.keys(TONE_LABELS) as StatusTone[]).map((tone) => (
            <FilterChip
              key={tone}
              label={TONE_LABELS[tone]}
              selected={filters.tones.includes(tone)}
              testID={`condition-timeline-filter-tone-${tone}`}
              onPress={() =>
                onChange({ ...filters, tones: toggle(filters.tones, tone) })
              }
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: TIMELINE_TONES[tone].node,
                    borderColor: TIMELINE_TONES[tone].icon,
                  },
                ]}
              />
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup icon={Calendar} label="Time period">
          <NativeSelect
            compact
            label="Time period"
            name="condition-timeline-filter-period"
            testID="condition-timeline-filter-period"
            value={filters.period}
            options={PERIODS}
            onChange={(period) =>
              onChange({ ...filters, period: period as TimelinePeriod })
            }
          />
        </FilterGroup>
        <FilterGroup icon={Shapes} label="Type" chips>
          {types.map((type) => {
            const { icon: Icon, id } = TIMELINE_TYPES[type];
            const selected = filters.types.includes(type);
            return (
              <FilterChip
                key={type}
                label={TYPE_LABELS[type]}
                selected={selected}
                testID={`condition-timeline-filter-type-${id}`}
                onPress={() =>
                  onChange({ ...filters, types: toggle(filters.types, type) })
                }
              >
                <Icon
                  size={14}
                  color={
                    selected ? COLORS.light.primary : COLORS.light.textSecondary
                  }
                />
              </FilterChip>
            );
          })}
        </FilterGroup>
      </View>
      <ModalActions>
        <ModalButton
          label="Reset"
          testID="condition-timeline-filters-reset"
          onPress={() => onChange(NO_TIMELINE_FILTERS)}
        />
        <ModalButton
          label="Done"
          tone="primary"
          testID="condition-timeline-filters-done"
          onPress={onClose}
        />
      </ModalActions>
    </CenteredModal>
  );
}

function FilterGroup({
  icon: Icon,
  label,
  chips = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Lays the children out as wrapping chips. */
  chips?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupLabel}>
        <Icon size={14} color={COLORS.light.muted} />
        <Text style={styles.groupLabelText}>{label}</Text>
      </View>
      {chips ? <View style={styles.chips}>{children}</View> : children}
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  testID,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {children}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: 16,
    marginTop: 6,
    marginBottom: 22,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    backgroundColor: COLORS.light.card,
  },
  chipSelected: {
    borderColor: COLORS.light.primary,
    backgroundColor: COLORS.light.statusActiveWash,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.light.primary,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
});
