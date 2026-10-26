import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Observation } from 'fhir/r5';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { getBiomarkerKey } from '@/src/data/biomarkers';
import {
  getMissingDemographics,
  getObservationMarker,
  getObservationStatus,
  isSupportedObservation,
  toRangeStatus,
} from '@/src/features/lab-results/biomarkerMeasurements';
import { withCalculatedObservations } from '@/src/features/lab-results/calculatedBiomarkers';
import type { RangeDemographics } from '@/src/features/lab-results/referenceRanges';
import { RangeProfileNotice } from '@/src/features/lab-results/RangeProfileNotice';
import { useRangeDemographics } from '@/src/features/lab-results/useRangeDemographics';
import { COLORS } from '@/src/theme/colors';
import { NativeSelect } from '@/src/components/NativeSelect';
import { CountBadge } from '@/src/components/CountBadge';
import { ResourceSection } from '@/src/components/ResourceSection';
import { BiomarkerStatusGrid } from '@/src/components/BiomarkerStatusGrid';
import { BiomarkerStatusGroups } from './BiomarkerStatusGroups';
import {
  SUMMARY_SORT_OPTIONS,
  sortSummaryBiomarkers,
  type SummarySort,
} from './labsSummarySorting';

export const PERIODS = [
  { id: 'all', label: 'All time', months: 0 },
  { id: '120', label: '10 years', months: 120 },
  { id: '60', label: '5 years', months: 60 },
  { id: '24', label: '2 years', months: 24 },
  { id: '12', label: '1 year', months: 12 },
  { id: '6', label: '6 months', months: 6 },
  { id: '1', label: '1 month', months: 1 },
];

/** Calendar-month cutoff, clamped for months with fewer days. */
export function periodCutoff(months: number) {
  if (!months) return -Infinity;
  const cutoff = new Date();
  const day = cutoff.getDate();
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - months);
  const lastDay = new Date(
    cutoff.getFullYear(),
    cutoff.getMonth() + 1,
    0
  ).getDate();
  cutoff.setDate(Math.min(day, lastDay));
  cutoff.setHours(0, 0, 0, 0);
  return cutoff.getTime();
}

/**
 * Uses clinical measurement dates rather than report creation or import
 * order. Includes the values calculated from each report's results.
 */
export function latestBiomarkers(
  records: DiagnosticReportRecord[],
  cutoff = -Infinity,
  demographics?: RangeDemographics
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
      status: toRangeStatus(
        getObservationStatus(observation, undefined, demographics)
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The latest result of each supported biomarker as a status grid. On Home
 * it is a section opening the full summary; the full summary adds the
 * results grouped by status, with sort and search.
 */
export function LabsSummary({
  records,
  showAll = false,
  initialPeriod = 'all',
  autoFocusSearch = false,
}: {
  records: DiagnosticReportRecord[];
  showAll?: boolean;
  initialPeriod?: string;
  /** Starts in the search field (the / keyboard shortcut). */
  autoFocusSearch?: boolean;
}) {
  const router = useRouter();
  const demographics = useRangeDemographics();
  const [search, setSearch] = useState('');
  // The user asked for search with a key, so focus is where they expect it.
  const searchRef = useRef<TextInput>(null);
  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);
  const [sort, setSort] = useState<SummarySort>('deviation');
  const [period, setPeriod] = useState(() =>
    PERIODS.some((option) => option.id === initialPeriod)
      ? initialPeriod
      : 'all'
  );
  const biomarkers = useMemo(
    () =>
      latestBiomarkers(
        records,
        periodCutoff(PERIODS.find((option) => option.id === period)!.months),
        demographics
      ),
    [records, period, demographics]
  );
  const missing = useMemo(
    () =>
      getMissingDemographics(
        biomarkers.map(({ observation }) => observation),
        demographics
      ),
    [biomarkers, demographics]
  );
  const notice = (
    <RangeProfileNotice
      missing={missing}
      testID="labs-summary-range-notice"
      style={styles.notice}
    />
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
            ...marker.aliases,
            observation.code.text || '',
            ...(observation.code.coding?.map(
              (coding) => coding.display || ''
            ) || []),
          ].some((value) => value.toLowerCase().includes(query));
        })
      : biomarkers;
    return sortSummaryBiomarkers(matches, sort, demographics);
  }, [biomarkers, query, showAll, sort, demographics]);

  const periodPicker = (
    <NativeSelect
      compact
      value={period}
      options={PERIODS}
      onChange={setPeriod}
      label="Period"
      testID="labs-summary-period"
      name="labs-summary-period"
    />
  );
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
          router.push({ pathname: '/labs-summary', params: { period } })
        }
      >
        <View style={styles.homeBody}>
          <View style={styles.homePeriod}>{periodPicker}</View>
          {grid}
          {notice}
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
      </View>
      {grid}
      {notice}
      <View style={styles.controlsRow}>
        <View style={styles.periodControl}>
          <Text style={styles.controlLabel}>Period</Text>
          {periodPicker}
        </View>
        <View style={styles.sortControl}>
          <Text style={styles.controlLabel}>Sort</Text>
          <NativeSelect
            compact
            value={sort}
            options={[...SUMMARY_SORT_OPTIONS]}
            onChange={(value) => setSort(value as SummarySort)}
            label="Sort"
            testID="labs-summary-sort"
            name="labs-summary-sort"
          />
        </View>
      </View>
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
          rowTestID={({ id }) => `labs-summary-result-${id}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  homeBody: { paddingBottom: 20 },
  homePeriod: { width: 100, marginBottom: 12 },
  notice: { marginTop: 16 },
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  periodControl: { width: 100 },
  sortControl: { width: 150 },
  controlLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.light.textSecondary,
  },
  searchInput: {
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
