import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Observation } from 'fhir/r5';
import type { DiagnosticReportRecord } from '@/src/database/types';
import {
  getObservationMarker,
  getObservationStatus,
  isSupportedCBCObservation,
} from '@/src/features/lab-results/biomarkerMeasurements';
import { COLORS } from '@/src/theme/colors';
import { NativeSelect } from '@/src/components/NativeSelect';
import { BiomarkerResultRow, BiomarkerStatusBadge } from './BiomarkerResultRow';
import {
  SUMMARY_SORT_OPTIONS,
  sortSummaryBiomarkers,
  type SummarySort,
} from './labsSummarySorting';

const PERIODS = [
  { id: 'all', label: 'All time', months: 0 },
  { id: '120', label: '10 years', months: 120 },
  { id: '60', label: '5 years', months: 60 },
  { id: '24', label: '2 years', months: 24 },
  { id: '12', label: '1 year', months: 12 },
  { id: '6', label: '6 months', months: 6 },
  { id: '1', label: '1 month', months: 1 },
];

/** Calendar-month cutoff, clamped for months with fewer days. */
function periodCutoff(months: number) {
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

const STATUS_COLORS = {
  Normal: COLORS.light.badgeNormalText,
  Low: COLORS.light.badgeLowText,
  High: COLORS.light.badgeHighText,
};
const CIRCUMFERENCE = 2 * Math.PI * 82;

/** Uses clinical measurement dates rather than report creation or import order. */
export function latestBiomarkers(
  records: DiagnosticReportRecord[],
  cutoff = -Infinity
) {
  const latest = new Map<
    string,
    { observation: Observation; time: number; date?: string }
  >();
  for (const { report, observations } of records) {
    for (const observation of observations) {
      if (!isSupportedCBCObservation(observation)) continue;
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
      const previous = latest.get(marker.loinc);
      // Equal dates keep the first result from the repository's newest-first order.
      if (!previous || time > previous.time) {
        latest.set(marker.loinc, { observation, time, date });
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
      status: getObservationStatus(observation),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Keeps search and summary rows identical, with a divider between results. */
function BiomarkerResultsList({
  biomarkers,
  prefix = 'labs-summary',
}: {
  biomarkers: ReturnType<typeof latestBiomarkers>;
  prefix?: string;
}) {
  return (
    <View style={styles.list}>
      {biomarkers.map(({ id, observation, date }, index) => (
        <View key={id}>
          {index > 0 && (
            <View style={styles.divider} testID={`${prefix}-divider`} />
          )}
          <BiomarkerResultRow
            observation={observation}
            date={date}
            testID={`${prefix}-result-${id}`}
          />
        </View>
      ))}
    </View>
  );
}

/** One equally sized ring segment and one latest result per supported biomarker. */
export function LabsSummary({
  records,
  showAll = false,
  initialPeriod = 'all',
}: {
  records: DiagnosticReportRecord[];
  showAll?: boolean;
  initialPeriod?: string;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const chartSize = Math.min(
    144,
    Math.max(100, width - (showAll ? 40 : 66) - 144)
  );
  const [search, setSearch] = useState('');
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
        periodCutoff(PERIODS.find((option) => option.id === period)!.months)
      ),
    [records, period]
  );
  const query = search.trim().toLowerCase();
  const searchResults = query
    ? biomarkers.filter(({ name, observation }) => {
        const marker = getObservationMarker(observation)!;
        return [
          name,
          marker.loinc,
          ...marker.aliases,
          observation.code.text || '',
          ...(observation.code.coding?.map((coding) => coding.display || '') ||
            []),
        ].some((value) => value.toLowerCase().includes(query));
      })
    : [];
  const sortedBiomarkers = useMemo(
    () => (showAll ? sortSummaryBiomarkers(biomarkers, sort) : biomarkers),
    [biomarkers, showAll, sort]
  );
  const listedBiomarkers = showAll
    ? sortedBiomarkers
    : biomarkers.filter(({ status }) => status === 'Low' || status === 'High');
  const counts = { Normal: 0, Low: 0, High: 0 };
  for (const { status } of biomarkers) {
    if (status) counts[status]++;
  }
  const unknown = biomarkers.length - counts.Normal - counts.Low - counts.High;
  const segmentLength = biomarkers.length
    ? CIRCUMFERENCE / biomarkers.length
    : 0;
  const description = `${biomarkers.length} biomarkers: ${counts.Normal} normal, ${counts.Low} low, ${counts.High} high${unknown ? `, ${unknown} unclassified` : ''}`;

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

  const sortPicker = (
    <NativeSelect
      compact
      value={sort}
      options={[...SUMMARY_SORT_OPTIONS]}
      onChange={(value) => setSort(value as SummarySort)}
      label="Sort"
      testID="labs-summary-sort"
      name="labs-summary-sort"
    />
  );

  return (
    <View testID="labs-summary">
      <View style={styles.overview}>
        {!showAll && (
          <View style={styles.periodSelect} testID="labs-summary-period-anchor">
            {periodPicker}
          </View>
        )}
        <View style={[styles.chart, { width: chartSize, height: chartSize }]}>
          <Svg
            width={chartSize}
            height={chartSize}
            viewBox="0 0 200 200"
            accessibilityRole="image"
            accessibilityLabel={description}
            testID="labs-summary-chart"
          >
            {!biomarkers.length && (
              <Circle
                cx={100}
                cy={100}
                r={82}
                fill="none"
                stroke={COLORS.light.border}
                strokeWidth={20}
              />
            )}
            {biomarkers.map(({ id, status }, index) => (
              <Circle
                key={id}
                testID={`labs-summary-segment-${id}`}
                cx={100}
                cy={100}
                r={82}
                fill="none"
                stroke={status ? STATUS_COLORS[status] : COLORS.light.border}
                strokeWidth={20}
                strokeDasharray={`${biomarkers.length === 1 ? segmentLength : segmentLength * 0.94} ${CIRCUMFERENCE}`}
                strokeDashoffset={-index * segmentLength}
                transform="rotate(-90 100 100)"
              />
            ))}
          </Svg>
          <View style={styles.total}>
            <Text style={styles.totalText} testID="labs-summary-total">
              {biomarkers.length}
            </Text>
            <Text style={styles.totalLabel}>Biomarkers</Text>
          </View>
        </View>
        <View style={[styles.legend, { marginLeft: chartSize / 2 + 4 }]}>
          <View style={styles.statusCounts} testID="labs-summary-status-counts">
            {(['Low', 'Normal', 'High'] as const).map((status) => (
              <View
                key={status}
                style={styles.legendRow}
                testID={`labs-summary-count-${status}`}
              >
                <BiomarkerStatusBadge status={status} compact />
                <Text style={styles.legendCount}>{counts[status]}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      {showAll && (
        <View style={styles.controlsRow}>
          <View
            style={styles.periodControl}
            testID="labs-summary-period-anchor"
          >
            <Text style={styles.controlLabel}>Period</Text>
            {periodPicker}
          </View>
          <View style={styles.sortSelect}>
            <Text style={styles.controlLabel}>Sort</Text>
            {sortPicker}
          </View>
        </View>
      )}
      {!showAll && (
        <View style={styles.searchArea}>
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
          />
          {!!query && (
            <View testID="labs-summary-search-results">
              {searchResults.length ? (
                <BiomarkerResultsList
                  biomarkers={searchResults}
                  prefix="labs-summary-search"
                />
              ) : (
                <Text style={styles.noResults}>No search results found</Text>
              )}
            </View>
          )}
        </View>
      )}
      {!showAll && (
        <View style={styles.listHeadingRow}>
          <Text style={styles.listHeading} accessibilityRole="header">
            Out of Range
          </Text>
          <Text
            style={styles.outOfRangeCount}
            testID="labs-summary-out-of-range-count"
          >
            ({listedBiomarkers.length} Biomarkers)
          </Text>
        </View>
      )}
      <BiomarkerResultsList biomarkers={listedBiomarkers} />
      {!showAll && (
        <TouchableOpacity
          style={styles.seeAllButton}
          testID="see-all-biomarkers-button"
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/labs-summary', params: { period } })
          }
          activeOpacity={0.75}
        >
          <Text style={styles.seeAllText}>See All Biomarkers</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overview: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  chart: { width: 144, height: 144 },
  total: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  totalText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  totalLabel: { fontSize: 12, color: COLORS.light.textSecondary },
  list: { gap: 8 },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  periodControl: { width: 100 },
  controlLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.light.textSecondary,
  },
  sortSelect: { width: 150 },
  listHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  outOfRangeCount: { fontSize: 12, color: '#000000' },
  listHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
  searchArea: { gap: 16, marginBottom: 20 },
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
  noResults: { fontSize: 14, color: COLORS.light.textSecondary },
  seeAllButton: {
    alignSelf: 'center',
    marginTop: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.light.primary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.primaryForeground,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.light.border,
    marginBottom: 8,
  },
  legend: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 68,
    height: 54,
    transform: [{ translateY: -27 }],
  },

  statusCounts: { gap: 6 },
  periodSelect: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    zIndex: 1,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendCount: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
});
