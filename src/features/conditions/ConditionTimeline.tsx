import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GitCommitVertical, ListFilter } from 'lucide-react-native';
import {
  ResourceSection,
  type ResourceRowAppearance,
} from '@/src/components/ResourceSection';
import { ConsultationRelatedRow } from '@/src/features/consultations/ConsultationRelatedRow';
import { ServiceRequestRelatedRow } from '@/src/features/service-requests/ServiceRequestRelatedRow';
import { TreatmentRelatedRow } from '@/src/features/treatments/TreatmentRelatedRow';
import { LabResultRelatedRow } from '@/src/features/lab-results/LabResultRelatedRow';
import { COLORS } from '@/src/theme/colors';
import {
  NO_TIMELINE_FILTERS,
  filterTimelineItems,
  groupTimelineItems,
  hasTimelineFilters,
  type TimelineItem,
} from './conditionTimeline';
import { TIMELINE_TONES, TIMELINE_TYPES } from './timelineAppearance';
import { TimelineFilterModal } from './TimelineFilterModal';

/**
 * Every step related to a condition on one rail, grouped by month. The node
 * icon shows the step's type; the row wash and node colour show its status,
 * and called-off steps are faded. The heading's filter button narrows the
 * steps by status, time period and type.
 */
export function ConditionTimeline({ items }: { items: TimelineItem[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState(NO_TIMELINE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = hasTimelineFilters(filters);
  const groups = useMemo(
    () => groupTimelineItems(filterTimelineItems(items, filters)),
    [items, filters]
  );
  const types = useMemo(
    () =>
      (Object.keys(TIMELINE_TYPES) as TimelineItem['type'][]).filter((type) =>
        items.some((item) => item.type === type)
      ),
    [items]
  );
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  let position = 0;

  const renderItem = (item: TimelineItem) => {
    const index = position++;
    const tone = TIMELINE_TONES[item.tone];
    const { icon: Icon, id: typeID } = TIMELINE_TYPES[item.type];
    const testID = `condition-timeline-item-${typeID}-${item.resource.id}`;
    const appearance: ResourceRowAppearance = {
      backgroundColor: tone.wash,
      dimmed: tone.dimmed,
      leading: (
        <View style={styles.rail}>
          {index > 0 && <View style={[styles.line, styles.lineAbove]} />}
          {index < count - 1 && (
            <View style={[styles.line, styles.lineBelow]} />
          )}
          <View
            testID={`${testID}-tone-${item.tone}`}
            style={[
              styles.node,
              { backgroundColor: tone.node },
              tone.dimmed && styles.dimmed,
            ]}
          >
            <Icon color={tone.icon} size={15} />
          </View>
        </View>
      ),
    };
    const props = { testID, appearance };
    switch (item.type) {
      case 'consultation':
        return (
          <ConsultationRelatedRow
            key={testID}
            {...props}
            consultation={item.resource}
            showNotes
            onPress={() => router.push(`/consultation/${item.resource.id}`)}
          />
        );
      case 'serviceRequest':
        return (
          <ServiceRequestRelatedRow
            key={testID}
            {...props}
            request={item.resource}
            onPress={() => router.push(`/service-request/${item.resource.id}`)}
          />
        );
      case 'treatment':
        return (
          <TreatmentRelatedRow
            key={testID}
            {...props}
            treatment={item.resource}
            onPress={() => router.push(`/treatment/${item.resource.id}`)}
          />
        );
      case 'labResult':
        return (
          <LabResultRelatedRow
            key={testID}
            {...props}
            report={item.resource}
            onPress={() => router.push(`/lab-result/${item.resource.id}`)}
          />
        );
    }
  };

  // No steps, no timeline. When filters hide every step, the section stays so
  // its filter button can still be reached.
  if (!items.length) return null;

  return (
    <ResourceSection
      icon={GitCommitVertical}
      title="Timeline"
      count={count}
      testID="condition-timeline"
      action={
        <TouchableOpacity
          testID="condition-timeline-filter-button"
          accessibilityRole="button"
          accessibilityLabel={
            filtered ? 'Filter timeline, filters on' : 'Filter timeline'
          }
          style={[styles.filterButton, filtered && styles.filterButtonActive]}
          activeOpacity={0.7}
          onPress={() => setFiltersOpen(true)}
        >
          <ListFilter
            size={18}
            color={
              filtered
                ? COLORS.light.primaryForeground
                : COLORS.light.textSecondary
            }
          />
        </TouchableOpacity>
      }
    >
      {count === 0 && (
        <Text style={styles.noMatches} testID="condition-timeline-no-matches">
          No steps match these filters.
        </Text>
      )}
      {groups.flatMap((group, groupIndex) => [
        <View
          key={`month-${group.label}`}
          style={styles.month}
          testID={`condition-timeline-month-${groupIndex}`}
        >
          <View style={styles.rail}>
            {groupIndex > 0 && <View style={[styles.line, styles.lineFull]} />}
          </View>
          <Text style={styles.monthText} accessibilityRole="header">
            {group.label}
          </Text>
        </View>,
        ...group.items.map(renderItem),
      ])}
      <TimelineFilterModal
        visible={filtersOpen}
        filters={filters}
        types={types}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </ResourceSection>
  );
}

const NODE_TOP = 16;
const NODE_SIZE = 28;

const styles = StyleSheet.create({
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: COLORS.light.primary,
    backgroundColor: COLORS.light.primary,
  },
  noMatches: {
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
    fontSize: 14,
    color: COLORS.light.textSecondary,
  },
  rail: {
    width: 40,
    alignSelf: 'stretch',
  },
  // Centred under the node.
  line: {
    position: 'absolute',
    left: NODE_SIZE / 2 - 1,
    width: 2,
    backgroundColor: COLORS.light.cardBorder,
  },
  lineAbove: {
    top: 0,
    height: NODE_TOP,
  },
  lineBelow: {
    top: NODE_TOP + NODE_SIZE,
    bottom: 0,
  },
  lineFull: {
    top: 0,
    bottom: 0,
  },
  node: {
    marginTop: NODE_TOP,
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.6,
  },
  // Spans the screen width like the rows, so the rail lines up.
  month: {
    marginHorizontal: -20,
    paddingLeft: 20,
    flexDirection: 'row',
  },
  monthText: {
    paddingTop: 14,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: COLORS.light.muted,
  },
});
