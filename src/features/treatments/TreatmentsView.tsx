import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FolderPlus, History, Pill } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { fetchMedicationStatements } from '@/src/features/actions/medicationStatementsRepository';
import {
  getCurrentUsage,
  getCurrentUsageLabel,
  getUsagePeriods,
  type CurrentUsage,
} from '@/src/features/actions/treatmentUsage';
import { NativeSelect } from '@/src/components/NativeSelect';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceSection } from '@/src/components/ResourceSection';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { COLORS } from '@/src/theme/colors';
import { getTreatmentReasonConditionIds } from '@/src/utils/fhirUtils';
import { getAllTreatments } from './treatmentService';
import { TreatmentRelatedRow } from './TreatmentRelatedRow';

type StatusFilter = 'all' | CurrentUsage;

const STATUS_FILTERS: StatusFilter[] = [
  'all',
  'taking',
  'on-hold',
  'stopped',
  'not-started',
];

const getStatusFilterLabel = (filter: StatusFilter) =>
  filter === 'all' ? 'All treatments' : getCurrentUsageLabel(filter);

interface TreatmentItem {
  treatment: MedicationRequest;
  usage: CurrentUsage;
}

/** Every treatment of the active patient, filtered by how it is used now. */
export function TreatmentsView() {
  const router = useRouter();
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const [status, setStatus] = useState<StatusFilter>('all');
  const generation = useRef(0);
  const [data, setData] = useState({
    patientId: '',
    items: [] as TreatmentItem[],
    isLoading: true,
    hasError: false,
  });
  const load = useCallback(async () => {
    if (isPatientLoading || !activePatientId) return;
    const request = ++generation.current;
    const patientId = activePatientId;
    try {
      const [treatments, statements] = await Promise.all([
        getAllTreatments(patientId),
        fetchMedicationStatements(patientId),
      ]);
      if (request !== generation.current) return;
      const items = treatments.map((treatment) => ({
        treatment,
        usage: getCurrentUsage(getUsagePeriods(statements, treatment.id || '')),
      }));
      setData({ patientId, items, isLoading: false, hasError: false });
    } catch (error) {
      if (request !== generation.current) return;
      console.error('Failed to load treatments:', error);
      setData({ patientId, items: [], isLoading: false, hasError: true });
    }
  }, [activePatientId, isPatientLoading]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        ++generation.current;
      };
    }, [load])
  );
  useDatabaseSubscription(
    ['medication_requests', 'medication_statements'],
    load
  );
  const isCurrentPatient = data.patientId === activePatientId;
  const isLoading =
    isPatientLoading ||
    (!!activePatientId && (!isCurrentPatient || data.isLoading));

  const items = isCurrentPatient ? data.items : [];
  const listed =
    status === 'all' ? items : items.filter((item) => item.usage === status);

  return (
    <ResourceViewLayout
      testID="treatments-view"
      title="Treatments"
      isLoading={isLoading}
      error={
        isCurrentPatient && data.hasError
          ? 'Unable to load treatments.'
          : undefined
      }
      actions={<ResourceActionDock actions={[]} />}
    >
      <View style={styles.content}>
        {items.length === 0 ? (
          <Text style={styles.emptyText} testID="treatments-empty">
            No treatments yet.
          </Text>
        ) : (
          <>
            <View style={styles.statusControl}>
              <Text style={styles.controlLabel}>Status</Text>
              <NativeSelect
                compact
                value={status}
                options={STATUS_FILTERS.map((id) => ({
                  id,
                  label: getStatusFilterLabel(id),
                }))}
                onChange={(value) => setStatus(value as StatusFilter)}
                label="Status"
                testID="treatments-status-filter"
                name="treatments-status-filter"
              />
            </View>
            {listed.length === 0 ? (
              <Text style={styles.emptyText} testID="treatments-no-matches">
                No treatments match this status.
              </Text>
            ) : (
              <ResourceSection
                icon={Pill}
                title={getStatusFilterLabel(status)}
                count={listed.length}
                testID="treatments-list"
              >
                {listed.map(({ treatment, usage }) => {
                  const treatId = treatment.id || '';
                  const conditionCount =
                    getTreatmentReasonConditionIds(treatment).length;
                  return (
                    <TreatmentRelatedRow
                      key={treatId}
                      treatment={treatment}
                      testID={`treatments-row-${treatId}`}
                      onPress={() =>
                        router.push({
                          pathname: '/treatment/[id]',
                          params: { id: treatId },
                        })
                      }
                      extraMeta={[
                        {
                          icon: History,
                          text: getCurrentUsageLabel(usage),
                          testID: `treatments-usage-${treatId}`,
                        },
                        ...(conditionCount > 0
                          ? [
                              {
                                icon: FolderPlus,
                                text: String(conditionCount),
                                accessibilityLabel: `${conditionCount} conditions`,
                              },
                            ]
                          : []),
                      ]}
                    />
                  );
                })}
              </ResourceSection>
            )}
          </>
        )}
      </View>
    </ResourceViewLayout>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 800, alignSelf: 'flex-start' },
  statusControl: { width: 160, gap: 4, marginBottom: 20 },
  controlLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.light.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.light.textSecondary,
  },
});
