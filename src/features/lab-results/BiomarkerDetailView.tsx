import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calculator,
  Calendar,
  ChevronDown,
  CircleDot,
  FileText,
  FlaskConical,
  FolderPlus,
  Hash,
  Waypoints,
} from 'lucide-react-native';
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import type { Observation } from 'fhir/r5';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { useIsWideLayout } from '@/src/theme/layout';
import { BiomarkerRangeLine } from '@/src/components/BiomarkerRangeLine';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { ResourceSection } from '@/src/components/ResourceSection';
import {
  BiomarkerResultRow,
  BiomarkerValueRow,
  getBiomarkerRouteId,
} from '@/src/features/home/BiomarkerResultRow';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllReports } from './diagnosticReportService';
import { getConditionLabResultLinks } from '@/src/features/conditions/conditionService';
import { ConditionRelatedRow } from '@/src/features/conditions/ConditionRelatedRow';
import { latestBiomarkers } from '@/src/features/home/LabsSummary';
import {
  isCalculatedObservation,
  withCalculatedObservations,
} from './calculatedBiomarkers';
import {
  BIOMARKERS,
  hasLoincCode,
  type BiomarkerCalculation,
  type BiomarkerDefinition,
} from '@/src/data/biomarkers';
import { COLORS } from '@/src/theme/colors';
import { formatDisplayDate } from '@/src/utils/dateUtils';

import {
  convertBiomarkerValue,
  getObservationMarker,
  getObservationReferenceRange,
  getObservationStatus,
  getObservationUnitCode,
  isSupportedObservation,
  RANGE_STATUS_LABELS,
  RANGE_STATUSES,
  toRangeStatus,
  type MeasurementReferenceRange,
  type RangeStatus,
} from './biomarkerMeasurements';
import {
  explainReferenceRange,
  resolveReferenceRange,
} from './referenceRanges';
import { RangeProfileNotice } from './RangeProfileNotice';
import { getChartScale } from './chartScale';
import { useRangeDemographics } from './useRangeDemographics';

type Measurement = {
  date: string;
  value: number;
  unit: string;
  id: string;
  name: string;
  status?: RangeStatus;
  reportId: string;
  unitCode: string;
  range?: MeasurementReferenceRange;
  /** Whether the laboratory reported the range, rather than the catalog. */
  reportedRange: boolean;
  observation: Observation;
};

/** Resolves a readable name from the observation's coding or text. */
function getObservationName(observation: Observation) {
  return (
    observation.code?.coding?.[0]?.display ||
    observation.code?.text ||
    'Biomarker'
  );
}

/** Gives a calculated biomarker's formula and names its inputs. */
function describeCalculation({ inputs, formula }: BiomarkerCalculation) {
  const names = inputs.map(({ id }) =>
    (typeof id === 'string' ? [id] : id)
      .map((input) => BIOMARKERS.find((marker) => marker.id === input)!.name)
      .join(' or ')
  );
  return `Worked out as ${formula}, from your ${names.join(' and ')} results in the same report:`;
}

/** Whether one biomarker is an input of the other's calculation. */
function isCalculationRelated(a: BiomarkerDefinition, b: BiomarkerDefinition) {
  const usesInput = (
    { calculation }: BiomarkerDefinition,
    input: BiomarkerDefinition
  ) => calculation?.inputs.some(({ id }) => [id].flat().includes(input.id));
  return usesInput(a, b) || usesInput(b, a);
}

/**
 * Other biomarkers with results that are read together with this one: the
 * inputs or results of its calculation first, then others in its catalog
 * category. The catch-all Other category relates nothing.
 */
function getRelatedBiomarkers<T extends { observation: Observation }>(
  marker: BiomarkerDefinition,
  biomarkers: T[]
) {
  const related = biomarkers.flatMap((biomarker) => {
    const other = getObservationMarker(biomarker.observation);
    if (!other || other.id === marker.id) return [];
    if (isCalculationRelated(marker, other))
      return [{ biomarker, calculation: true }];
    if (marker.category !== 'Other' && other.category === marker.category)
      return [{ biomarker, calculation: false }];
    return [];
  });
  return [
    ...related.filter(({ calculation }) => calculation),
    ...related.filter(({ calculation }) => !calculation),
  ].map(({ biomarker }) => biomarker);
}

/** Shows patient-scoped biomarker history with compatible units and education. */
export function BiomarkerDetailView({
  id: selectedId,
}: {
  /** Shown beside the biomarker list on desktop instead of the route's. */
  id?: string;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = selectedId ?? params.id;
  const isWideWindow = useIsWideLayout();
  const isWide = !selectedId && isWideWindow;
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const demographics = useRangeDemographics();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [history, setHistory] = useState({
    patientId: '',
    reports: [] as Awaited<ReturnType<typeof getAllReports>>,
    conditionLinks: [] as Awaited<
      ReturnType<typeof getConditionLabResultLinks>
    >,
    isLoading: true,
    hasError: false,
  });
  const loadGeneration = useRef(0);
  const isCurrentPatient = history.patientId === activePatientId;
  const reports = useMemo(
    () => (isCurrentPatient && activePatientId ? history.reports : []),
    [isCurrentPatient, activePatientId, history.reports]
  );
  const isLoading =
    isPatientLoading ||
    (!!activePatientId && (!isCurrentPatient || history.isLoading));
  const hasError = isCurrentPatient && history.hasError;

  /** Loads only an initialized patient scope and ignores obsolete completions. */
  const load = useCallback(async () => {
    if (isPatientLoading || !activePatientId) return;
    const generation = ++loadGeneration.current;
    const patientId = activePatientId;
    // A reload for the same patient keeps showing the loaded results until
    // the new ones arrive, so the page doesn't flash its skeleton.
    setHistory((previous) =>
      previous.patientId === patientId && !previous.isLoading
        ? previous
        : {
            patientId,
            reports: [],
            conditionLinks: [],
            isLoading: true,
            hasError: false,
          }
    );
    try {
      const [loadedReports, conditionLinks] = await Promise.all([
        getAllReports(patientId),
        getConditionLabResultLinks(patientId),
      ]);
      if (generation !== loadGeneration.current) return;
      setHistory({
        patientId,
        reports: loadedReports,
        conditionLinks,
        isLoading: false,
        hasError: false,
      });
    } catch (error) {
      if (generation !== loadGeneration.current) return;
      console.error('Failed to load biomarker history:', error);
      setHistory({
        patientId,
        reports: [],
        conditionLinks: [],
        isLoading: false,
        hasError: true,
      });
    }
  }, [activePatientId, isPatientLoading]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        ++loadGeneration.current;
      };
    }, [load])
  );
  useDatabaseSubscription(
    ['diagnostic_reports', 'observations', 'conditions', 'service_requests'],
    load
  );

  const marker = BIOMARKERS.find(
    (candidate) =>
      candidate.id === id ||
      hasLoincCode(candidate, id) ||
      candidate.name.toLowerCase() === (id || '').toLowerCase() ||
      candidate.aliases.some(
        (alias) => alias.toLowerCase() === (id || '').toLowerCase()
      )
  );

  const measurements = useMemo(() => {
    const matches: Measurement[] = [];
    for (const record of withCalculatedObservations(reports)) {
      const reportDate = record.report.effectiveDateTime || '';
      for (const observation of record.observations) {
        if (!isSupportedObservation(observation)) continue;
        const code = observation.code?.coding?.[0]?.code;
        const displayName = getObservationName(observation);
        const name = displayName.toLowerCase();
        const isMatch = marker
          ? hasLoincCode(marker, code) ||
            marker.aliases.some((alias) => name === alias.toLowerCase()) ||
            name === marker.name.toLowerCase()
          : (code !== 'custom' && code === id) ||
            name === (id || '').toLowerCase();
        const value = observation.valueQuantity?.value;
        if (isMatch && typeof value === 'number') {
          matches.push({
            date: observation.effectiveDateTime || reportDate,
            value,
            unit:
              observation.valueQuantity?.unit ||
              observation.valueQuantity?.code ||
              '',
            id: observation.id || `${record.report.id}-${matches.length}`,
            name: displayName,
            status: toRangeStatus(
              getObservationStatus(observation, marker, demographics)
            ),
            reportId: record.report.id || '',
            unitCode: getObservationUnitCode(observation),
            range: getObservationReferenceRange(
              observation,
              marker,
              demographics
            ),
            reportedRange: Boolean(observation.referenceRange?.length),
            observation,
          });
        }
      }
    }
    return matches.sort((a, b) => a.date.localeCompare(b.date));
  }, [id, marker, reports, demographics]);

  const latestMeasurement = measurements[measurements.length - 1];
  /** The latest result's own code: a test's units can have codes of their own. */
  const latestCode =
    latestMeasurement?.observation.code.coding?.find(
      (coding) => coding.system === 'http://loinc.org'
    )?.code ?? marker?.loinc;
  /** The recorded results the latest calculated value was worked out from. */
  const latestSources = useMemo(() => {
    const references = new Set(
      latestMeasurement?.observation.derivedFrom?.map(
        ({ reference }) => reference
      )
    );
    return reports
      .flatMap(({ observations }) => observations)
      .filter(({ id }) => references.has(`Observation/${id}`));
  }, [latestMeasurement, reports]);
  const chartMeasurements = useMemo(
    () =>
      latestMeasurement
        ? measurements.flatMap((measurement) => {
            const value = convertBiomarkerValue(
              measurement.value,
              measurement.unitCode,
              latestMeasurement.unitCode,
              marker
            );
            return value === undefined
              ? []
              : [{ ...measurement, value, unit: latestMeasurement.unit }];
          })
        : [],
    [measurements, latestMeasurement, marker]
  );

  /** Conditions whose lab results include this biomarker. */
  const conditions = useMemo(() => {
    const reportIds = new Set(measurements.map(({ reportId }) => reportId));
    return (isCurrentPatient ? history.conditionLinks : [])
      .filter((link) => link.reportIds.some((id) => reportIds.has(id)))
      .map(({ condition }) => condition);
  }, [measurements, isCurrentPatient, history.conditionLinks]);
  const relatedBiomarkers = useMemo(
    () =>
      marker
        ? getRelatedBiomarkers(
            marker,
            latestBiomarkers(reports, -Infinity, demographics)
          )
        : [],
    [marker, reports, demographics]
  );

  if (isLoading)
    return <ResourceViewLayout testID="biomarker-view" isLoading />;
  if (hasError)
    return (
      <ResourceViewLayout
        testID="biomarker-view"
        error="Failed to load biomarker history."
      />
    );
  if (!id || measurements.length === 0)
    return (
      <ResourceViewLayout
        testID="biomarker-view"
        error="Biomarker not found."
      />
    );

  const title = marker?.name || measurements[0].name;
  const latestRange =
    marker && !latestMeasurement.reportedRange
      ? resolveReferenceRange(marker, demographics, latestMeasurement.date)
      : undefined;
  const about = (
    <>
      {marker?.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{marker.description}</Text>
        </View>
      )}
    </>
  );
  const latest = (
    <>
      <View style={styles.section} testID="biomarker-latest">
        <Text style={styles.sectionTitle}>Latest</Text>
        <View style={styles.latestValueGroup}>
          <Text style={styles.latestValue} testID="biomarker-latest-value">
            {latestMeasurement.value}
          </Text>
          <Text style={styles.latestUnit} testID="biomarker-latest-unit">
            {latestMeasurement.unit}
          </Text>
        </View>
        <BiomarkerRangeLine
          value={latestMeasurement.value}
          low={latestMeasurement.range?.low}
          high={latestMeasurement.range?.high}
          width="100%"
          large
          testID="biomarker-latest-range"
        />
      </View>
    </>
  );
  const calculated = (
    <>
      {marker?.calculation && latestSources.length > 0 && (
        <ResourceSection
          icon={Calculator}
          title="Calculated from"
          testID="biomarker-calculation"
        >
          <Text
            style={[styles.description, styles.calculationText]}
            testID="biomarker-calculation-formula"
          >
            {describeCalculation(marker.calculation)}
          </Text>
          {latestSources.map((source) => (
            <BiomarkerResultRow
              key={source.id}
              observation={source}
              testID={`biomarker-source-result-${getBiomarkerRouteId(source)}`}
            />
          ))}
        </ResourceSection>
      )}
    </>
  );
  const range = (
    <>
      {marker && (
        <View style={styles.section} testID="biomarker-range">
          <Text style={styles.sectionTitle}>Reference range</Text>
          <Text style={styles.description} testID="biomarker-range-explanation">
            {latestRange
              ? explainReferenceRange(marker, latestRange)
              : 'This range comes from your laboratory report.'}
          </Text>
          <RangeProfileNotice
            missing={latestRange?.missing ?? []}
            testID="biomarker-range-notice"
            style={styles.notice}
          />
        </View>
      )}
    </>
  );
  const chart = (
    <>
      {chartMeasurements.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Value history</Text>
          <View style={styles.legend} testID="biomarker-chart-legend">
            {RANGE_STATUSES.map((status) => (
              <View key={status} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: STATUS_COLORS[status] },
                  ]}
                />
                <Text style={styles.legendLabel}>
                  {RANGE_STATUS_LABELS[status]}
                </Text>
              </View>
            ))}
          </View>
          <BiomarkerChart
            measurements={chartMeasurements}
            low={latestMeasurement.range?.low}
            high={latestMeasurement.range?.high}
            fill={isWide || Boolean(selectedId)}
          />
        </View>
      )}
    </>
  );
  const results = (
    <>
      <ResourceSection
        icon={FlaskConical}
        title="Results"
        count={measurements.length}
        testID="biomarker-history"
      >
        <CollapsibleList
          items={[...measurements].reverse()}
          testID="biomarker-history-list"
          renderItem={(measurement) => (
            <View key={measurement.id}>
              <BiomarkerValueRow
                title={formatDisplayDate(measurement.date)}
                value={measurement.value}
                unit={measurement.unit}
                low={measurement.range?.low}
                high={measurement.range?.high}
                calculated={isCalculatedObservation(measurement.observation)}
                accessibilityLabel={`View lab result: ${formatDisplayDate(measurement.date)}`}
                testID={`biomarker-history-${measurement.id}`}
                rangeTestID={`biomarker-history-range-${measurement.id}`}
                onPress={() =>
                  router.push(`/lab-result/${measurement.reportId}`)
                }
              />
            </View>
          )}
        />
      </ResourceSection>
    </>
  );
  const conditionsSection = (
    <>
      <ResourceSection
        icon={FolderPlus}
        title="Conditions"
        count={conditions.length}
        testID="biomarker-conditions"
      >
        {conditions.map((condition) => (
          <ConditionRelatedRow
            key={condition.id}
            condition={condition}
            testID={`biomarker-condition-${condition.id}`}
            onPress={() => router.push(`/condition/${condition.id}`)}
          />
        ))}
      </ResourceSection>
    </>
  );
  const related = (
    <>
      <ResourceSection
        icon={Waypoints}
        title="Related biomarkers"
        count={relatedBiomarkers.length}
        testID="biomarker-related"
      >
        {relatedBiomarkers.length > 0 && (
          <CollapsibleList
            items={relatedBiomarkers}
            testID="biomarker-related-list"
            renderItem={({ id: key, observation }) => (
              <BiomarkerResultRow
                key={key}
                observation={observation}
                testID={`biomarker-related-result-${key}`}
              />
            )}
          />
        )}
      </ResourceSection>
    </>
  );
  const learn = (
    <>
      <View style={styles.learnSection} testID="biomarker-learn">
        <Text style={styles.sectionTitle}>Learn</Text>
        <LearnItem title="About this biomarker">
          {marker?.education?.about ||
            marker?.description ||
            'This biomarker is one part of your laboratory result and is interpreted together with other findings.'}
        </LearnItem>
        <LearnItem title="Why it matters">
          {marker?.education?.whyItMatters ||
            'This result adds information about this part of your health. It is interpreted together with related test results and your health history.'}
        </LearnItem>
        <LearnItem title="What it may affect">
          {marker?.education?.whatItMayAffect || ''}
        </LearnItem>
        <LearnItem title="What may be related to a change">
          {marker?.education?.whatMayBeRelatedToAChange || ''}
        </LearnItem>
      </View>
    </>
  );
  return (
    <ResourceViewLayout
      testID="biomarker-view"
      contentKey={id}
      wide={isWide}
      title={title}
      titleTestID="biomarker-title"
      meta={[
        {
          icon: Calendar,
          text: formatDisplayDate(latestMeasurement.date),
          testID: 'biomarker-latest-date',
        },
        ...(latestMeasurement.status
          ? [
              {
                icon: CircleDot,
                text: RANGE_STATUS_LABELS[latestMeasurement.status],
                testID: 'biomarker-latest-status',
              },
            ]
          : []),
        ...(latestCode
          ? [{ icon: Hash, text: latestCode, testID: 'biomarker-loinc' }]
          : []),
        ...(isCalculatedObservation(latestMeasurement.observation)
          ? [
              {
                icon: Calculator,
                text: 'Calculated',
                testID: 'biomarker-calculated',
              },
            ]
          : []),
      ]}
      // Beside the biomarker list, the list's page owns the dock.
      actions={
        selectedId ? undefined : (
          <ResourceActionDock
            onAdd={() => setShowAddMenu((visible) => !visible)}
            addLabel="Add record"
            addTestID="floating-add-button"
            addMenuExpanded={showAddMenu}
          />
        )
      }
      modal={
        !selectedId && (
          <FloatingAddMenu
            visible={showAddMenu}
            onClose={() => setShowAddMenu(false)}
            options={[
              {
                id: 'lab-results',
                label: 'Lab Results',
                testID: 'menu-add-lab-results',
                icon: (
                  <FileText
                    color={COLORS.light.primary}
                    size={18}
                    style={{ marginRight: 10 }}
                  />
                ),
                onPress: () => router.push('/lab-result/add'),
              },
            ]}
          />
        )
      }
    >
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {latest}
            {chart}
            {results}
            {calculated}
          </View>
          <View style={styles.column}>
            {about}
            {range}
            {conditionsSection}
            {related}
            {learn}
          </View>
        </View>
      ) : (
        <>
          {about}
          {latest}
          {calculated}
          {range}
          {chart}
          {results}
          {conditionsSection}
          {related}
          {learn}
        </>
      )}
    </ResourceViewLayout>
  );
}

/**
 * A full-width row, divided like resource rows, that expands its educational
 * text below the title; the chevron on the right turns when open.
 */
function LearnItem({ title, children }: { title: string; children: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!children.trim()) return null;

  return (
    <View style={styles.learnItem}>
      <Pressable
        accessibilityRole="button"
        aria-expanded={expanded}
        accessibilityLabel={title}
        testID={`learn-toggle-${title.toLowerCase().replaceAll(' ', '-')}`}
        onPress={() => setExpanded((current) => !current)}
        style={styles.learnItemToggle}
      >
        <Text style={styles.learnItemTitle}>{title}</Text>
        <View
          style={[
            styles.learnChevronBox,
            expanded && styles.learnChevronExpanded,
          ]}
        >
          <ChevronDown size={18} color={COLORS.light.muted} />
        </View>
      </Pressable>
      {expanded && <Text style={styles.learnText}>{children}</Text>}
    </View>
  );
}

/** Formats a chart number without floating point noise from unit conversion. */
const formatChartValue = (value: number) =>
  String(Number(value.toPrecision(10)));

/** Spacing of the chart's graph grid, matching the marketing site. */
const CHART_GRID = 22;

/**
 * Keeps the labels that have room, newest first so the latest result is
 * always labelled: a label too close to one already kept is left out.
 */
function spacedLabels(
  points: { x: number; y: number }[],
  minX: number,
  minY = Infinity
) {
  const kept: number[] = [];
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index];
    if (
      kept.every(
        (other) =>
          Math.abs(points[other].x - point.x) >= minX ||
          Math.abs(points[other].y - point.y) >= minY
      )
    )
      kept.push(index);
  }
  return new Set(kept);
}

/**
 * Plots compatible measurements by date against the latest result's
 * reference range: a colour-coded axis, a tinted in-range band whose edges
 * fall on grid lines, each value above its point and its date below.
 */
function BiomarkerChart({
  measurements,
  low,
  high,
  fill = false,
}: {
  measurements: Measurement[];
  low?: number;
  high?: number;
  /** Spans its column instead of stopping at 600px (desktop layouts). */
  fill?: boolean;
}) {
  const [chartWidth, setChartWidth] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxChartWidth = Math.max(
    1,
    Math.min(
      fill ? screenWidth : 600,
      screenWidth - insets.left - insets.right - 40
    )
  );
  const width = chartWidth || maxChartWidth;
  const height = 260;
  const axisX = 48;
  const plotRight = width - 8;
  const plotWidth = Math.max(0, plotRight - axisX);
  const plotBottom = height - 44;
  // The plot is a whole number of grid squares tall.
  const rows = Math.floor((plotBottom - 12) / CHART_GRID);
  const paddingTop = plotBottom - rows * CHART_GRID;
  const values = measurements.map((item) => item.value);
  const hasRange = low !== undefined || high !== undefined;
  // The axis ends are labelled to the precision of the values and limits.
  const decimals = Math.min(
    2,
    Math.max(
      ...[...values, low, high].map(
        (value) =>
          (value === undefined
            ? ''
            : formatChartValue(value).split('.')[1] || ''
          ).length
      )
    )
  );
  const { min, max } = getChartScale(values, rows, low, high);
  /** Maps a value to the chart's vertical coordinate. */
  const yFor = (value: number) =>
    plotBottom - ((value - min) / (max - min)) * (plotBottom - paddingTop);
  const bandTop = yFor(high ?? max);
  const bandBottom = yFor(low ?? min);
  /** Status of a value against the displayed range. */
  const statusFor = (value: number): RangeStatus | undefined =>
    !hasRange
      ? undefined
      : (low !== undefined && value < low) ||
          (high !== undefined && value > high)
        ? 'outOfRange'
        : 'inRange';
  const inset = 28;
  // Points are spaced by date, so gaps between tests show as gaps.
  const times = measurements.map(({ date }) => Date.parse(date));
  const first = Math.min(...times);
  const span = Math.max(...times) - first;
  const points = measurements.map((item, index) => ({
    x:
      axisX +
      inset +
      (span ? (times[index] - first) / span : 0.5) *
        (plotRight - axisX - inset * 2),
    y: yFor(item.value),
    status: statusFor(item.value),
  }));
  const dateLabels = spacedLabels(points, 44);
  const valueLabels = spacedLabels(points, 30, 16);
  const endStatus = hasRange ? ('outOfRange' as const) : undefined;
  const axisLabels = [
    { value: max, text: max.toFixed(decimals), status: endStatus },
    ...(high !== undefined
      ? [
          {
            value: high,
            text: formatChartValue(high),
            status: 'inRange' as const,
          },
        ]
      : []),
    ...(low !== undefined
      ? [
          {
            value: low,
            text: formatChartValue(low),
            status: 'inRange' as const,
          },
        ]
      : []),
    { value: min, text: min.toFixed(decimals), status: endStatus },
  ];
  return (
    <View
      style={[styles.chart, fill ? styles.chartFill : { width: maxChartWidth }]}
      testID="biomarker-chart"
      accessibilityLabel="Biomarker values over time"
      onLayout={(event) => {
        // A screen laid out off-screen during navigation reports no width.
        const layoutWidth = event.nativeEvent.layout.width;
        if (layoutWidth > 0)
          setChartWidth(Math.min(maxChartWidth, layoutWidth));
      }}
    >
      <View style={{ width, height }}>
        {/* eslint-disable @typescript-eslint/no-deprecated -- These x/y props position SVG geometry, not deprecated View transforms. */}
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {hasRange && (
            <>
              <Rect
                x={axisX}
                y={paddingTop}
                width={plotWidth}
                height={bandTop - paddingTop}
                fill={COLORS.light.outOfRangeWash}
              />
              <Rect
                x={axisX}
                y={bandTop}
                width={plotWidth}
                height={bandBottom - bandTop}
                fill={COLORS.light.inRangeWash}
              />
              <Rect
                x={axisX}
                y={bandBottom}
                width={plotWidth}
                height={plotBottom - bandBottom}
                fill={COLORS.light.outOfRangeWash}
              />
            </>
          )}
          {/* The notebook's graph grid, drawn only inside the plot. */}
          {Array.from(
            { length: Math.floor(plotWidth / CHART_GRID) },
            (_, index) => axisX + (index + 1) * CHART_GRID
          ).map((x) => (
            <Line
              key={`grid-x-${x}`}
              x1={x}
              x2={x}
              y1={paddingTop}
              y2={plotBottom}
              stroke={COLORS.light.chartGrid}
              strokeWidth="1"
            />
          ))}
          {Array.from(
            { length: Math.floor((plotBottom - paddingTop) / CHART_GRID) },
            (_, index) => plotBottom - (index + 1) * CHART_GRID
          ).map((y) => (
            <Line
              key={`grid-y-${y}`}
              x1={axisX}
              x2={plotRight}
              y1={y}
              y2={y}
              stroke={COLORS.light.chartGrid}
              strokeWidth="1"
            />
          ))}
          {/* The axis takes the colour of the range it passes through. */}
          <Rect
            x={axisX - 3}
            y={paddingTop}
            width={3}
            height={plotBottom - paddingTop}
            fill={hasRange ? COLORS.light.outOfRange : COLORS.light.border}
          />
          {hasRange && (
            <Rect
              x={axisX - 3}
              y={bandTop}
              width={3}
              height={bandBottom - bandTop}
              fill={COLORS.light.primary}
            />
          )}
          {axisLabels.map(({ value, text, status }, index) => (
            <SvgText
              key={index}
              x={axisX - 8}
              y={yFor(value) + 4}
              fill={status ? STATUS_TEXT_COLORS[status] : COLORS.light.muted}
              fontSize="11"
              fontWeight="700"
              textAnchor="end"
            >
              {text}
            </SvgText>
          ))}
          <Polyline
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={COLORS.light.pillBorder}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map(({ x, y, status }, index) => {
            const [day, year] = formatDisplayDate(
              measurements[index].date
            ).split(', ');
            return (
              <React.Fragment key={measurements[index].id}>
                <Circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={COLORS.light.background}
                  stroke={status ? STATUS_COLORS[status] : COLORS.light.muted}
                  strokeWidth="3"
                />
                {valueLabels.has(index) && (
                  <SvgText
                    x={x}
                    y={y - 14}
                    fill={
                      status
                        ? STATUS_TEXT_COLORS[status]
                        : COLORS.light.foreground
                    }
                    fontSize="12"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {formatChartValue(measurements[index].value)}
                  </SvgText>
                )}
                {dateLabels.has(index) && (
                  <>
                    <SvgText
                      x={x}
                      y={plotBottom + 18}
                      fill={COLORS.light.mutedForeground}
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {day}
                    </SvgText>
                    <SvgText
                      x={x}
                      y={plotBottom + 32}
                      fill={COLORS.light.mutedForeground}
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {year}
                    </SvgText>
                  </>
                )}
              </React.Fragment>
            );
          })}
        </Svg>
        {/* eslint-enable @typescript-eslint/no-deprecated */}
        {points.map((point, index) => (
          <View
            key={measurements[index].id}
            testID={`biomarker-point-${index}`}
            accessible
            accessibilityLabel={`${formatDisplayDate(measurements[index].date)}: ${formatChartValue(measurements[index].value)} ${measurements[index].unit}`}
            style={[
              styles.pointTarget,
              { left: point.x - 12, top: point.y - 12 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const STATUS_COLORS: Record<RangeStatus, string> = {
  outOfRange: COLORS.light.outOfRange,
  inRange: COLORS.light.primary,
};
const STATUS_TEXT_COLORS: Record<RangeStatus, string> = {
  outOfRange: COLORS.light.outOfRangeText,
  inRange: COLORS.light.primary,
};

const styles = StyleSheet.create({
  pointTarget: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  latestValueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  latestValue: {
    color: COLORS.light.foreground,
    fontSize: 32,
    fontWeight: '700',
  },
  latestUnit: { color: COLORS.light.muted, fontSize: 14 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: COLORS.light.pillBackground,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 16, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 12, color: COLORS.light.textSecondary },
  // Closes the last row with the same full-width hairline.
  learnSection: {
    marginBottom: 28,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  // Spans the screen width like resource rows, divided by the same hairline.
  learnItem: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
  learnItemToggle: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  learnItemTitle: {
    flex: 1,
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  // Lines up with the chevrons of resource rows.
  learnChevronBox: {
    width: 48,
    height: 48,
    marginRight: -15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnChevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  learnText: {
    paddingBottom: 16,
    color: COLORS.light.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  section: { marginBottom: 28 },
  columns: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  notice: { marginTop: 16 },
  sectionTitle: {
    color: COLORS.light.foreground,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: COLORS.light.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  calculationText: { marginBottom: 12 },
  chart: { maxWidth: 600 },
  chartFill: { width: '100%', maxWidth: '100%' },
});
