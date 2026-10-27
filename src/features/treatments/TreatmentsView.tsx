import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { FilterButton, FilterNoMatches } from '@/src/components/FilterControls';
import { ListDetailLayout } from '@/src/components/ListDetailLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceSection } from '@/src/components/ResourceSection';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { COLORS } from '@/src/theme/colors';
import { useIsWideLayout } from '@/src/theme/layout';
import { useSavedFilters } from '@/src/utils/savedFilters';
import { getTreatmentReasonConditionIds } from '@/src/utils/fhirUtils';
import { TIMELINE_TONES } from '@/src/features/conditions/timelineAppearance';
import { getAllTreatments } from './treatmentService';
import {
  TreatmentFilterModal,
  USAGE_FILTERS,
  USAGE_TONES,
} from './TreatmentFilterModal';
import { TreatmentRelatedRow } from './TreatmentRelatedRow';
import { ViewTreatmentView } from './ViewTreatmentView';

interface TreatmentItem {
  treatment: MedicationRequest;
  usage: CurrentUsage;
}

const NO_STATUSES: CurrentUsage[] = [];

const parseStatuses = (saved: unknown) =>
  Array.isArray(saved)
    ? USAGE_FILTERS.filter((usage) => saved.includes(usage))
    : null;

/** Every treatment of the active patient, filtered by how it is used now. */
export function TreatmentsView() {
  const router = useRouter();
  const { treatment: selected } = useLocalSearchParams<{
    treatment?: string;
  }>();
  const isWideWindow = useIsWideLayout();
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  // Each profile remembers its own filters on this device.
  const [statuses, setStatuses, filtersLoaded] = useSavedFilters(
    activePatientId ? `treatments:${activePatientId}` : null,
    NO_STATUSES,
    parseStatuses
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    (!!activePatientId &&
      (!isCurrentPatient || data.isLoading || !filtersLoaded));

  const items = isCurrentPatient ? data.items : [];
  const filtered = statuses.length > 0;
  const listed = filtered
    ? items.filter((item) => statuses.includes(item.usage))
    : items;

  // Desktop: the list stays on the left and the chosen treatment shows on
  // the right, starting with the first one listed. The split stays while
  // filters match nothing, so the layout doesn't jump.
  const selectedId = listed.some(({ treatment }) => treatment.id === selected)
    ? selected
    : listed[0]?.treatment.id;
  const isSplit = isWideWindow && !isLoading && items.length > 0;

  const list =
    items.length === 0 ? (
      <Text style={styles.emptyText} testID="treatments-empty">
        No treatments yet.
      </Text>
    ) : (
      <ResourceSection
        icon={Pill}
        title={
          filtered
            ? USAGE_FILTERS.filter((usage) => statuses.includes(usage))
                .map(getCurrentUsageLabel)
                .join(', ')
            : 'All treatments'
        }
        count={listed.length}
        testID="treatments-list"
        action={
          <FilterButton
            label="Filter treatments"
            active={filtered}
            testID="treatments-filter-button"
            onPress={() => setFiltersOpen(true)}
          />
        }
      >
        {listed.length === 0 && (
          <FilterNoMatches testID="treatments-no-matches">
            No treatments match these filters.
          </FilterNoMatches>
        )}
        {listed.map(({ treatment, usage }) => {
          const treatId = treatment.id || '';
          const conditionCount =
            getTreatmentReasonConditionIds(treatment).length;
          return (
            <TreatmentRelatedRow
              key={treatId}
              treatment={treatment}
              testID={`treatments-row-${treatId}`}
              appearance={{
                backgroundColor: TIMELINE_TONES[USAGE_TONES[usage]].wash,
                selected: isSplit && treatId === selectedId,
              }}
              onPress={() =>
                isSplit
                  ? router.setParams({ treatment: treatId })
                  : router.push({
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
    );

  // Outside both layouts, so a filter change that switches between them
  // keeps the modal open.
  const filterModal = (
    <TreatmentFilterModal
      visible={filtersOpen}
      statuses={statuses}
      onChange={setStatuses}
      onClose={() => setFiltersOpen(false)}
    />
  );

  return (
    <>
      {isSplit ? (
        <ListDetailLayout
          title="Treatments"
          listId="treatment-list"
          rowLabel="View treatment:"
          testID="treatments-view"
          list={list}
          detail={
            selectedId ? (
              <ViewTreatmentView
                key={selectedId}
                id={selectedId}
                onDeleted={() => router.setParams({ treatment: undefined })}
              />
            ) : null
          }
          // The chosen treatment brings its own dock.
          dock={selectedId ? null : <ResourceActionDock actions={[]} />}
        />
      ) : (
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
          <View style={styles.content}>{list}</View>
        </ResourceViewLayout>
      )}
      {filterModal}
    </>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 800, alignSelf: 'flex-start' },
  emptyText: {
    fontSize: 14,
    color: COLORS.light.textSecondary,
  },
});
