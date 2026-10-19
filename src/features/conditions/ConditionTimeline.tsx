import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ClipboardList,
  FlaskConical,
  GitCommitVertical,
  Pill,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react-native';
import {
  ResourceSection,
  type ResourceRowAppearance,
} from '@/src/components/ResourceSection';
import { ConsultationRelatedRow } from '@/src/features/consultations/ConsultationRelatedRow';
import { ServiceRequestRelatedRow } from '@/src/features/service-requests/ServiceRequestRelatedRow';
import { TreatmentRelatedRow } from '@/src/features/treatments/TreatmentRelatedRow';
import { LabResultRelatedRow } from '@/src/features/lab-results/LabResultRelatedRow';
import { COLORS } from '@/src/theme/colors';
import type {
  StatusTone,
  TimelineGroup,
  TimelineItem,
} from './conditionTimeline';

const TYPES: Record<TimelineItem['type'], { icon: LucideIcon; id: string }> = {
  consultation: { icon: Stethoscope, id: 'consultation' },
  serviceRequest: { icon: ClipboardList, id: 'service-request' },
  treatment: { icon: Pill, id: 'treatment' },
  labResult: { icon: FlaskConical, id: 'lab-result' },
};

const TONES: Record<
  StatusTone,
  { wash?: string; node: string; icon: string; dimmed?: boolean }
> = {
  planned: {
    wash: COLORS.light.statusPlannedWash,
    node: COLORS.light.statusPlannedNode,
    icon: COLORS.light.statusPlannedIcon,
  },
  active: {
    wash: COLORS.light.statusActiveWash,
    node: COLORS.light.emptyIconContainer,
    icon: COLORS.light.primary,
  },
  paused: {
    wash: COLORS.light.statusPausedWash,
    node: COLORS.light.statusPausedNode,
    icon: COLORS.light.statusPausedIcon,
  },
  done: {
    node: COLORS.light.pillBackground,
    icon: COLORS.light.mutedForeground,
  },
  faded: {
    node: COLORS.light.pillBackground,
    icon: COLORS.light.muted,
    dimmed: true,
  },
};

/**
 * Every step related to a condition on one rail, grouped by month. The node
 * icon shows the step's type; the row wash and node colour show its status,
 * and called-off steps are faded.
 */
export function ConditionTimeline({ groups }: { groups: TimelineGroup[] }) {
  const router = useRouter();
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  let position = 0;

  const renderItem = (item: TimelineItem) => {
    const index = position++;
    const tone = TONES[item.tone];
    const { icon: Icon, id: typeID } = TYPES[item.type];
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

  return (
    <ResourceSection
      icon={GitCommitVertical}
      title="Timeline"
      count={count}
      testID="condition-timeline"
    >
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
    </ResourceSection>
  );
}

const NODE_TOP = 16;
const NODE_SIZE = 28;

const styles = StyleSheet.create({
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
