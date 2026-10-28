import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Observation } from 'fhir/r5';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { getBiomarkerKey } from '@/src/data/biomarkers';
import {
  getObservationMarker,
  isSupportedObservation,
  toRangeStatus,
} from '@/src/features/lab-results/biomarkerMeasurements';
import {
  getObservationStatus,
  type BiomarkerRanges,
} from '@/src/features/lab-results/biomarkerRanges';
import { withCalculatedObservations } from '@/src/features/lab-results/calculatedBiomarkers';
import { useBiomarkerRanges } from '@/src/features/lab-results/useBiomarkerRanges';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { NativeSelect } from '@/src/components/NativeSelect';
import { CountBadge } from '@/src/components/CountBadge';
import { ResourceSection } from '@/src/components/ResourceSection';
import { BiomarkerStatusGrid } from '@/src/components/BiomarkerStatusGrid';
import { BiomarkerStatusGroups } from './BiomarkerStatusGroups';
import { FilterButton } from '@/src/components/FilterControls';
import { sortSummaryBiomarkers } from './labsSummarySorting';
import {
  DEFAULT_LABS_SUMMARY_FILTERS,
  hasLabsSummaryFilters,
  isPeriod,
  PERIODS,
  periodCutoff,
  periodMonths,
  type LabsSummaryFilters,
} from './labsSummaryFilters';
import { LabsSummaryFilterModal } from './LabsSummaryFilterModal';

/**
 * Uses clinical measurement dates rather than report creation or import
 * order. Includes the values calculated from each report's results.
 */
export function latestBiomarkers(
  records: DiagnosticReportRecord[],
  cutoff = -Infinity,
  ranges?: BiomarkerRanges
) {
  const latest = new Map<
    string,
    { observation: Observation; time: number; date?: string }
  >();
  for (const { report, observations } of withCalculatedObservations(records)) {
    for (const observation of observations) {
      if (!isSupportedObservation(observation)) continue;
      const marker = getObservationMarker(observation)!;
      const date =
        observation.effectiveDateTime ||
        observation.effectivePeriod?.end ||
        observation.effectivePeriod?.start ||
        report.effectiveDateTime ||
        report.effectivePeriod?.end ||
        report.effectivePeriod?.start ||
        observation.issued ||
        report.issued;
      const parsed = date ? Date.parse(date) : NaN;
      const time = Number.isFinite(parsed) ? parsed : -Infinity;
      if (time < cutoff) continue;
      const key = getBiomarkerKey(marker);
      const previous = latest.get(key);
      // Equal dates keep the first result from the repository's newest-first order.
      if (!previous || time > previous.time) {
        latest.set(key, { observation, time, date });
      }
    }
  }
  return [...latest.entries()]
    .map(([id, { observation, time, date }]) => ({
      id,
      observation,
      time,
      date,
      name: getObservationMarker(observation)!.name,
      status: toRangeStatus(getObservationStatus(observation, ranges)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The latest result of each supported biomarker as a status grid. On Home
 * it is a section with a period picker, opening the full summary; the full
 * summary adds the results grouped by status, with search, and a filter
 * button for the period and sort, whose choice its page keeps.
 */
export function LabsSummary({
  records,
  showAll = false,
  filters = DEFAULT_LABS_SUMMARY_FILTERS,
  onFiltersChange,
  autoFocusSearch = false,
}: {
  records: DiagnosticReportRecord[];
  showAll?: boolean;
  /** The full summary's period and sort. */
  filters?: LabsSummaryFilters;
  onFiltersChange?: (filters: LabsSummaryFilters) => void;
  /** Starts in the search field (the / keyboard shortcut). */
  autoFocusSearch?: boolean;
}) {
  const router = useRouter();
  const { activePatientId } = useActivePatient();
  const ranges = useBiomarkerRanges();
  const [search, setSearch] = useState('');
  // The user asked for search with a key, so focus is where they expect it.
  const searchRef = useRef<TextInput>(null);
  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);
  const [homePeriod, setHomePeriod] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const period = showAll
    ? isPeriod(filters.period)
      ? filters.period
      : 'all'
    : homePeriod;
  const { sort } = filters;
  const biomarkers = useMemo(
    () => latestBiomarkers(records, periodCutoff(periodMonths(period)), ranges),
    [records, period, ranges]
  );
  const query = search.trim().toLowerCase();
  const listed = useMemo(() => {
    if (!showAll) return [];
    const matches = query
      ? biomarkers.filter(({ name, observation }) => {
          const marker = getObservationMarker(observation)!;
          return [
            name,
            marker.loinc ?? '',
            ...Object.values(marker.unitLoinc ?? {}),
            ...marker.aliases,
            observation.code.text || '',
            ...(observation.code.coding?.map(
              (coding) => coding.display || ''
            ) || []),
          ].some((value) => value.toLowerCase().includes(query));
        })
      : biomarkers;
    return sortSummaryBiomarkers(matches, sort, ranges);
  }, [biomarkers, query, showAll, sort, ranges]);

  const grid = (
    <BiomarkerStatusGrid items={biomarkers} testID="labs-summary-grid" />
  );

  if (!showAll) {
    return (
      <ResourceSection
        icon={FlaskConical}
        title="Biomarkers"
        count={biomarkers.length}
        testID="labs-summary"
        pressLabel="Open biomarkers"
        pressTestID="labs-summary-open"
        onPress={() =>
          // Only a chosen period replaces the summary's saved one, and only
          // for the profile it was chosen for.
          router.push({
            pathname: '/labs-summary',
            params:
              period === 'all' || !activePatientId
                ? {}
                : { period, patient: activePatientId },
          })
        }
      >
        <View style={styles.homeBody}>
          <View style={styles.homePeriod}>
            <NativeSelect
              compact
              value={homePeriod}
              options={PERIODS}
              onChange={setHomePeriod}
              label="Period"
              testID="labs-summary-period"
              name="labs-summary-period"
            />
          </View>
          {grid}
        </View>
      </ResourceSection>
    );
  }

  return (
    <View testID="labs-summary">
      <View style={styles.heading}>
        <Text style={styles.headingText} accessibilityRole="header">
          Latest results
        </Text>
        <CountBadge
          count={biomarkers.length}
          accessibilityLabel={`Latest results: ${biomarkers.length} biomarkers`}
          testID="labs-summary-total"
        />
        <View style={styles.headingAction}>
          <FilterButton
            label="Filter latest results"
            active={hasLabsSummaryFilters(filters)}
            testID="labs-summary-filter-button"
            onPress={() => setFiltersOpen(true)}
          />
        </View>
      </View>
      {grid}
      <TextInput
        id="labs-summary-search"
        nativeID="labs-summary-search"
        name="labs-summary-search"
        testID="labs-summary-search"
        accessibilityLabel="Search"
        placeholder="Search"
        placeholderTextColor={COLORS.light.placeholder}
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        autoCapitalize="none"
        ref={searchRef}
      />
      {query && listed.length === 0 ? (
        <Text style={styles.noResults} testID="labs-summary-no-results">
          No search results found
        </Text>
      ) : (
        <BiomarkerStatusGroups
          biomarkers={listed}
          testID="labs-summary-groups"
          expanded={Boolean(query)}
          rowTestID={({ id }) => `labs-summary-result-${id}`}
        />
      )}
      <LabsSummaryFilterModal
        visible={filtersOpen}
        filters={filters}
        onChange={(next) => onFiltersChange?.(next)}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  homeBody: { paddingBottom: 20 },
  homePeriod: { width: 100, marginBottom: 12 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  headingAction: { marginLeft: 'auto' },
  searchInput: {
    marginTop: 20,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 8,
    fontSize: 15,
    color: COLORS.light.foreground,
  },
  noResults: {
    marginTop: 20,
    fontSize: 14,
    color: COLORS.light.textSecondary,
  },
});
