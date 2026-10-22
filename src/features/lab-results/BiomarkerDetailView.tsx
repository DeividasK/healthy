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
  Hash,
} from 'lucide-react-native';
import Svg, { Circle, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type { Observation } from 'fhir/r5';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { BiomarkerRangeLine } from '@/src/components/BiomarkerRangeLine';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { ResourceSection } from '@/src/components/ResourceSection';
import { BiomarkerValueRow } from '@/src/features/home/BiomarkerResultRow';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllReports } from './diagnosticReportService';
import { withCalculatedObservations } from './calculatedBiomarkers';
import { BIOMARKERS, type BiomarkerCalculation } from '@/src/data/biomarkers';
import { COLORS } from '@/src/theme/colors';
import { formatDisplayDate } from '@/src/utils/dateUtils';

import {
  convertBiomarkerValue,
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
};

/** Resolves a readable name from the observation's coding or text. */
function getObservationName(observation: Observation) {
  return (
    observation.code?.coding?.[0]?.display ||
    observation.code?.text ||
    'Biomarker'
  );
}

/** Names a calculated biomarker's inputs and gives its formula. */
function describeCalculation({ inputs, formula }: BiomarkerCalculation) {
  const names = inputs.map(
    ({ id }) => BIOMARKERS.find((marker) => marker.id === id)!.name
  );
  return `Worked out from your ${names.join(' and ')} results in the same report: ${formula}.`;
}

/** Shows patient-scoped biomarker history with compatible units and education. */
export function BiomarkerDetailView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const demographics = useRangeDemographics();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [history, setHistory] = useState({
    patientId: '',
    reports: [] as Awaited<ReturnType<typeof getAllReports>>,
    isLoading: true,
    hasError: false,
  });
  const loadGeneration = useRef(0);
  const isCurrentPatient = history.patientId === activePatientId;
  const reports = isCurrentPatient && activePatientId ? history.reports : [];
  const isLoading =
    isPatientLoading ||
    (!!activePatientId && (!isCurrentPatient || history.isLoading));
  const hasError = isCurrentPatient && history.hasError;

  /** Loads only an initialized patient scope and ignores obsolete completions. */
  const load = useCallback(async () => {
    if (isPatientLoading || !activePatientId) return;
    const generation = ++loadGeneration.current;
    const patientId = activePatientId;
    setHistory({ patientId, reports: [], isLoading: true, hasError: false });
    try {
      const loadedReports = await getAllReports(patientId);
      if (generation !== loadGeneration.current) return;
      setHistory({
        patientId,
        reports: loadedReports,
        isLoading: false,
        hasError: false,
      });
    } catch (error) {
      if (generation !== loadGeneration.current) return;
      console.error('Failed to load biomarker history:', error);
      setHistory({ patientId, reports: [], isLoading: false, hasError: true });
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
  useDatabaseSubscription(['diagnostic_reports', 'observations'], load);

  const marker = BIOMARKERS.find(
    (candidate) =>
      candidate.id === id ||
      candidate.loinc === id ||
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
          ? (marker.loinc !== undefined && code === marker.loinc) ||
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
          });
        }
      }
    }
    return matches.sort((a, b) => a.date.localeCompare(b.date));
  }, [id, marker, reports, demographics]);

  const latestMeasurement = measurements[measurements.length - 1];
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
  return (
    <ResourceViewLayout
      testID="biomarker-view"
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
        ...(marker?.loinc
          ? [{ icon: Hash, text: marker.loinc, testID: 'biomarker-loinc' }]
          : []),
        ...(marker?.calculation
          ? [
              {
                icon: Calculator,
                text: 'Calculated',
                testID: 'biomarker-calculated',
              },
            ]
          : []),
      ]}
      actions={
        <ResourceActionDock
          onAdd={() => setShowAddMenu((visible) => !visible)}
          addLabel="Add record"
          addTestID="floating-add-button"
          addMenuExpanded={showAddMenu}
        />
      }
      modal={
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
      }
    >
      {marker?.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{marker.description}</Text>
        </View>
      )}
      {marker?.calculation && (
        <View style={styles.section} testID="biomarker-calculation">
          <Text style={styles.sectionTitle}>How it’s calculated</Text>
          <Text style={styles.description}>
            {describeCalculation(marker.calculation)}
          </Text>
        </View>
      )}
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
          />
        </View>
      )}
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

/**
 * Plots compatible measurements against the latest result's reference range:
 * a colour-coded axis, a tinted in-range band, each value above its point and
 * its date below.
 */
function BiomarkerChart({
  measurements,
  low,
  high,
}: {
  measurements: Measurement[];
  low?: number;
  high?: number;
}) {
  const [chartWidth, setChartWidth] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxChartWidth = Math.max(
    1,
    Math.min(600, screenWidth - insets.left - insets.right - 40)
  );
  const width = chartWidth || maxChartWidth;
  const height = 260;
  const axisX = 48;
  const plotRight = width - 8;
  const plotWidth = Math.max(0, plotRight - axisX);
  const paddingTop = 12;
  const plotBottom = height - 44;
  const values = measurements.map((item) => item.value);
  const hasRange = low !== undefined || high !== undefined;
  const rawMin = Math.min(...values, low ?? Infinity);
  const rawMax = Math.max(...values, high ?? -Infinity);
  const pad = (rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1)) * 0.2;
  // The axis ends are rounded to the precision of the values and limits.
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
  const step = 10 ** -decimals;
  // Values that cannot be negative keep the axis at or above zero.
  const min =
    Math.floor(
      (rawMin >= 0 ? Math.max(0, rawMin - pad) : rawMin - pad) / step
    ) * step;
  const max = Math.ceil((rawMax + pad) / step) * step;
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
  const points = measurements.map((item, index) => ({
    x:
      axisX +
      inset +
      (index / (measurements.length - 1)) * (plotRight - axisX - inset * 2),
    y: yFor(item.value),
    status: statusFor(item.value),
  }));
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
      style={[styles.chart, { width: maxChartWidth }]}
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
  chart: { maxWidth: 600 },
});
