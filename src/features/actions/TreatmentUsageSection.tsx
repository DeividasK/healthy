import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  CalendarRange,
  FileText,
  History,
  MessageSquareText,
  Pencil,
  Play,
  Repeat,
  SlidersHorizontal,
} from 'lucide-react-native';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { formatUsageDuration, formatUsagePeriod } from './usageDuration';
import { formatDosingLines } from '@/src/features/treatments/regimen';
import { ResourceRow, ResourceSection } from '@/src/components/ResourceSection';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { COLORS } from '@/src/theme/colors';
import {
  getCurrentUsage,
  isSameRegimen,
  type UsagePeriod,
} from './treatmentUsage';
import { getUsageChangeLabel } from './TreatmentUsageFormView';
import { getTreatmentUsage } from './treatmentUsageService';

/** The concept icon for treatment usage, e.g. its section heading. */
export const USAGE_ICON = History;
/** The concept icon for treatment regimens. */
const REGIMEN_ICON = Repeat;

const formatPeriod = (period: UsagePeriod) =>
  formatUsagePeriod(period.start, period.end);

/**
 * A treatment's usage (FHIR MedicationStatement periods). `primaryAction` is
 * the screen's main button: play to start or resume taking, or change its
 * usage while taking it, each opening the usage form. `editPeriod` opens a
 * recorded period's edit form, where it can also be removed.
 */
export function useTreatmentUsage(treatmentId: string, patientId: string) {
  const router = useRouter();
  const [periods, setPeriods] = useState<UsagePeriod[]>([]);
  const loadSequence = useRef(0);

  const loadData = useCallback(async () => {
    if (!treatmentId) return;
    const sequence = ++loadSequence.current;
    try {
      const loaded = await getTreatmentUsage(patientId, treatmentId);
      if (sequence === loadSequence.current) setPeriods(loaded);
    } catch (err) {
      console.error('Failed to load treatment usage:', err);
    }
  }, [patientId, treatmentId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(['medication_statements'], loadData);

  const current = getCurrentUsage(periods);
  const isTaking = current === 'taking';
  // Start or resume taking it; while taking it, change its usage.
  const primaryAction = {
    label: getUsageChangeLabel(current),
    testID: isTaking ? 'treatment-usage-change' : 'treatment-usage-start',
    icon: isTaking ? SlidersHorizontal : Play,
    onPress: () =>
      router.push({
        pathname: '/treatment/[id]/usage',
        params: { id: treatmentId },
      }),
  };

  return {
    periods,
    isTaking,
    /** The screen's main button: start or resume, or change while taking. */
    primaryAction,
    /** Opens a recorded period's edit form. */
    editPeriod: (period: UsagePeriod) =>
      router.push({
        pathname: '/treatment/[id]/usage',
        params: { id: treatmentId, period: period.statement.id },
      }),
  };
}

/**
 * When the treatment was actually taken, paused or stopped, newest first,
 * each with a pencil to edit or remove it. The journal only asks about days
 * it was being taken. Left out until a period is recorded.
 */
export function TreatmentUsageSection({
  periods,
  onEdit,
}: {
  periods: UsagePeriod[];
  onEdit: (period: UsagePeriod) => void;
}) {
  if (!periods.length) return null;
  // Each period's regimen shows once it has changed, so periods differ.
  const taking = periods.filter((period) => period.state === 'taking');
  const hasChanged = taking.some(
    (period) => !isSameRegimen(period.dosage, taking[0].dosage)
  );
  const regimenMeta = (period: UsagePeriod) =>
    hasChanged && period.state === 'taking'
      ? formatDosingLines(period.dosage).map((text) => ({
          icon: REGIMEN_ICON,
          text,
        }))
      : [];
  return (
    <ResourceSection
      icon={USAGE_ICON}
      title="Usage"
      count={periods.length}
      testID="treatment-usage-section"
    >
      <CollapsibleList
        items={[...periods].reverse()}
        testID="treatment-usage-list"
        renderItem={(period) => (
          <ResourceRow
            key={period.statement.id}
            testID={`treatment-usage-period-${period.statement.id}`}
            title={period.label}
            meta={[
              {
                icon: CalendarRange,
                text: formatUsageDuration(period.start, period.end),
              },
              { icon: Calendar, text: formatPeriod(period) },
              ...regimenMeta(period),
              ...(period.reason
                ? [{ icon: MessageSquareText, text: period.reason }]
                : []),
              ...(period.notes ? [{ icon: FileText, text: period.notes }] : []),
            ]}
            accessory={
              <TouchableOpacity
                testID={`treatment-usage-edit-${period.statement.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${period.label}, ${formatPeriod(period)}`}
                hitSlop={10}
                style={styles.edit}
                activeOpacity={0.6}
                onPress={() => onEdit(period)}
              >
                <Pencil size={16} color={COLORS.light.iconClear} />
              </TouchableOpacity>
            }
          />
        )}
      />
    </ResourceSection>
  );
}

const styles = StyleSheet.create({
  // Sized like a form field's remove x.
  edit: {
    padding: 8,
    marginRight: -8,
  },
});
