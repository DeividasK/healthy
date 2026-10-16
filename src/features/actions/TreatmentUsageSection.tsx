import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  CalendarRange,
  FileText,
  History,
  MessageSquareText,
  Play,
  Square,
  X,
} from 'lucide-react-native';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { formatUsageDuration } from './usageDuration';
import { ResourceRow, ResourceSection } from '@/src/components/ResourceSection';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { getCurrentUsage, type UsagePeriod } from './treatmentUsage';
import { getUsageChangeLabel } from './TreatmentUsageFormView';
import {
  getTreatmentUsage,
  removeTreatmentUsage,
} from './treatmentUsageService';

/** The concept icon for treatment usage, e.g. its section heading. */
export const USAGE_ICON = History;

/** e.g. "Oct 13, 2026 – Oct 19, 2026", "Oct 20, 2026" or "Since Oct 25, 2026". */
const formatPeriod = (period: UsagePeriod) =>
  !period.end
    ? `Since ${formatDisplayDate(period.start)}`
    : period.end === period.start
      ? formatDisplayDate(period.start)
      : `${formatDisplayDate(period.start)} – ${formatDisplayDate(period.end)}`;

/**
 * A treatment's usage (FHIR MedicationStatement periods). `primaryAction` is
 * the screen's main button: play to start or resume taking, or stop while
 * taking, each opening the usage form. Periods are removed from the list
 * after confirming; `modals` holds that confirmation, rendered at the
 * screen's top level.
 */
export function useTreatmentUsage(treatmentId: string, patientId: string) {
  const router = useRouter();
  const [periods, setPeriods] = useState<UsagePeriod[]>([]);
  // The period the user asked to remove, awaiting confirmation.
  const [removing, setRemoving] = useState<UsagePeriod | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
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

  const confirmRemove = async () => {
    if (!removing?.statement.id) return;
    setRemovalError(null);
    try {
      await removeTreatmentUsage(treatmentId, removing.statement.id, patientId);
      setRemoving(null);
    } catch (err) {
      console.error('Failed to remove treatment usage:', err);
      setRemovalError('Failed to remove period. Please try again.');
    }
  };

  const current = getCurrentUsage(periods);
  const isTaking = current === 'taking';
  const primaryAction = {
    label: getUsageChangeLabel(current),
    testID: isTaking ? 'treatment-usage-stop' : 'treatment-usage-start',
    icon: isTaking ? Square : Play,
    onPress: () =>
      router.push({
        pathname: '/treatment/[id]/usage',
        params: { id: treatmentId },
      }),
  };

  const modals = (
    <DeleteConfirmationModal
      visible={removing !== null}
      title="Remove period"
      message={
        removing
          ? `Remove "${removing.label}" (${formatPeriod(removing)})? The period before it will run up to the next one.`
          : ''
      }
      confirmLabel="Remove"
      requireCountdown={false}
      onConfirm={confirmRemove}
      onCancel={() => {
        setRemoving(null);
        setRemovalError(null);
      }}
      testID="treatment-usage-remove-dialog"
    >
      {removalError && (
        <FormErrorBanner
          message={removalError}
          testID="treatment-usage-remove-error"
        />
      )}
    </DeleteConfirmationModal>
  );

  return {
    periods,
    /** The screen's main button: start or resume, or stop while taking. */
    primaryAction,
    /** Asks to remove a period, after confirmation. */
    requestRemove: (period: UsagePeriod) => {
      setRemovalError(null);
      setRemoving(period);
    },
    modals,
  };
}

/**
 * When the treatment was actually taken, paused or stopped, newest first,
 * each with an x to remove it. The journal only asks about days it was being
 * taken. Left out until a period is recorded.
 */
export function TreatmentUsageSection({
  periods,
  onRemove,
}: {
  periods: UsagePeriod[];
  onRemove: (period: UsagePeriod) => void;
}) {
  if (!periods.length) return null;
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
              ...(period.reason
                ? [{ icon: MessageSquareText, text: period.reason }]
                : []),
              ...(period.notes ? [{ icon: FileText, text: period.notes }] : []),
            ]}
            accessory={
              <TouchableOpacity
                testID={`treatment-usage-remove-${period.statement.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${period.label}, ${formatPeriod(period)}`}
                hitSlop={10}
                style={styles.remove}
                activeOpacity={0.6}
                onPress={() => onRemove(period)}
              >
                <X size={16} color={COLORS.light.iconClear} />
              </TouchableOpacity>
            }
          />
        )}
      />
    </ResourceSection>
  );
}

const styles = StyleSheet.create({
  // Sized and coloured like a form field's remove x.
  remove: {
    padding: 8,
    marginRight: -8,
  },
});
