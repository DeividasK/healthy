import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, FileText } from 'lucide-react-native';
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
import { BiomarkerRangeLine } from '@/src/components/BiomarkerRangeLine';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllReports } from './diagnosticReportService';
import { CBC_MARKERS } from '@/src/data/cbcMarkers';
import { COLORS } from '@/src/theme/colors';
import { formatDisplayDate } from '@/src/utils/dateUtils';

import {
  convertBiomarkerValue,
  getObservationReferenceRange,
  getObservationStatus,
  getObservationUnitCode,
  type MeasurementReferenceRange,
  type MeasurementStatus,
} from './biomarkerMeasurements';

type Measurement = {
  date: string;
  value: number;
  unit: string;
  id: string;
  name: string;
  status?: MeasurementStatus;
  unitCode: string;
  range?: MeasurementReferenceRange;
};

function getObservationName(observation: Observation) {
  return (
    observation.code?.coding?.[0]?.display ||
    observation.code?.text ||
    'Biomarker'
  );
}

export function BiomarkerDetailView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId } = useActivePatient();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [reports, setReports] = useState<
    Awaited<ReturnType<typeof getAllReports>>
  >([]);
  const [isHistoryListExpanded, setIsHistoryListExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    try {
      setReports(await getAllReports(activePatientId));
      setHasError(false);
    } catch (error) {
      console.error('Failed to load biomarker history:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [activePatientId]);

  useFocusEffect(useCallback(() => void load(), [load]));
  useDatabaseSubscription(['diagnostic_reports', 'observations'], load);

  const marker = CBC_MARKERS.find(
    (candidate) =>
      candidate.id === id ||
      candidate.loinc === id ||
      candidate.name.toLowerCase() ===
        decodeURIComponent(id || '').toLowerCase() ||
      candidate.aliases.some(
        (alias) =>
          alias.toLowerCase() === decodeURIComponent(id || '').toLowerCase()
      )
  );

  const measurements = useMemo(() => {
    const matches: Measurement[] = [];
    for (const record of reports) {
      const reportDate = record.report.effectiveDateTime || '';
      for (const observation of record.observations) {
        const code = observation.code?.coding?.[0]?.code;
        const name = getObservationName(observation).toLowerCase();
        const isMatch = marker
          ? code === marker.loinc ||
            marker.aliases.some((alias) => name === alias.toLowerCase()) ||
            name === marker.name.toLowerCase()
          : code === id || name === decodeURIComponent(id || '').toLowerCase();
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
            name,
            status: getObservationStatus(observation, marker),
            unitCode: getObservationUnitCode(observation),
            range: getObservationReferenceRange(observation, marker),
          });
        }
      }
    }
    return matches.sort((a, b) => a.date.localeCompare(b.date));
  }, [id, marker, reports]);

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
  return (
    <ResourceViewLayout
      testID="biomarker-view"
      title={title}
      titleTestID="biomarker-title"
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
              label: 'Add Lab Results',
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
      <View style={styles.latestSection} testID="biomarker-latest">
        <Text style={styles.sectionTitle}>Latest</Text>
        <View style={styles.latestValueGroup}>
          <Text style={styles.latestValue} testID="biomarker-latest-value">
            {latestMeasurement.value}
          </Text>
          <Text style={styles.unit} testID="biomarker-latest-unit">
            {latestMeasurement.unit}
          </Text>
          <MeasurementStatusBadge
            status={latestMeasurement.status}
            testID="biomarker-latest-status"
          />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Value history</Text>
        {chartMeasurements.length > 1 && (
          <BiomarkerChart
            measurements={chartMeasurements}
            low={latestMeasurement.range?.low}
            high={latestMeasurement.range?.high}
          />
        )}
        <View style={styles.historyListContainer}>
          <Pressable
            accessibilityRole="button"
            aria-expanded={isHistoryListExpanded}
            onPress={() => setIsHistoryListExpanded((expanded) => !expanded)}
            style={styles.historyListToggle}
            testID="biomarker-history-list-toggle"
          >
            <Text style={styles.historyListTitle}>List</Text>
            <View
              style={[
                styles.learnChevronBox,
                isHistoryListExpanded && styles.learnChevronExpanded,
              ]}
            >
              <ChevronDown size={18} color={COLORS.light.foreground} />
            </View>
          </Pressable>
          {isHistoryListExpanded && (
            <View style={styles.history} testID="biomarker-history-list">
              {[...measurements].reverse().map((measurement) => (
                <View key={measurement.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>
                    {formatDisplayDate(measurement.date)}
                  </Text>
                  <View style={styles.historyValueColumn}>
                    <View style={styles.valueGroup}>
                      <Text style={styles.historyValue}>
                        {measurement.value}
                      </Text>
                      <Text style={styles.unit}>{measurement.unit}</Text>
                      <MeasurementStatusBadge
                        status={measurement.status}
                        testID={`biomarker-status-${measurement.id}`}
                      />
                    </View>
                    <BiomarkerRangeLine
                      value={measurement.value}
                      low={measurement.range?.low}
                      high={measurement.range?.high}
                      testID={`biomarker-history-range-${measurement.id}`}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      <View style={styles.section} testID="biomarker-learn">
        <Text style={styles.sectionTitle}>Learn</Text>
        <LearnItem title="About this biomarker">
          {marker?.education?.about ||
            marker?.description ||
            'This biomarker is one part of your laboratory result and is interpreted together with other findings.'}
        </LearnItem>
        <LearnItem title="Why it matters">
          {marker?.education?.whyItMatters ||
            'This result adds information about this part of your blood health. It is interpreted together with related test results and your health history.'}
        </LearnItem>
        <LearnItem title="What it may affect">
          {marker?.education?.whatItMayAffect || ''}
        </LearnItem>
        <LearnItem title="What may be related to a change">
          {marker?.education?.whatMayBeRelatedToAChange || ''}
        </LearnItem>
        <Text style={styles.learnNote}>
          A result outside the reference range does not diagnose a condition by
          itself. Your clinician can interpret it with your other results and
          health history.
        </Text>
      </View>
    </ResourceViewLayout>
  );
}

function LearnItem({ title, children }: { title: string; children: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!children.trim()) return null;

  return (
    <View
      style={[
        styles.learnItem,
        expanded && children.length > 0 && styles.learnItemExpanded,
      ]}
    >
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
          <ChevronDown size={18} color={COLORS.light.foreground} />
        </View>
      </Pressable>
      {expanded && children.length > 0 && (
        <Text style={styles.learnText}>{children}</Text>
      )}
    </View>
  );
}

function MeasurementStatusBadge({
  status,
  testID,
}: {
  status?: MeasurementStatus;
  testID: string;
}) {
  if (!status) return null;
  return (
    <View
      testID={testID}
      style={[
        styles.statusBadge,
        styles[
          `status${status}` as 'statusLow' | 'statusNormal' | 'statusHigh'
        ],
      ]}
    >
      <Text
        style={[
          styles.statusText,
          styles[
            `statusText${status}` as
              'statusTextLow' | 'statusTextNormal' | 'statusTextHigh'
          ],
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

function BiomarkerChart({
  measurements,
  low,
  high,
}: {
  measurements: Measurement[];
  low?: number;
  high?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxChartWidth = Math.max(
    1,
    Math.min(600, screenWidth - insets.left - insets.right - 4)
  );
  const width = chartWidth || Math.max(1, maxChartWidth - 24);
  const height = 320;
  // Keep axis labels and date ticks inside the SVG viewport on narrow screens.
  const paddingLeft = Math.min(64, Math.max(32, width * 0.1));
  const paddingRight = Math.min(48, Math.max(28, width * 0.12));
  const paddingTop = 32;
  const paddingBottom = 48;
  const values = measurements.map((item) => item.value);
  const lowValue = low ?? Math.min(...values);
  const highValue = high ?? Math.max(...values);
  const referenceSpan =
    highValue - lowValue || Math.max(Math.abs(highValue) * 0.1, 1);
  const min = Math.min(lowValue, ...values) - referenceSpan * 0.15;
  const max = Math.max(highValue, ...values) + referenceSpan * 0.15;
  const spread = max - min;
  const yFor = (value: number) =>
    height -
    paddingBottom -
    ((value - min) / spread) * (height - paddingTop - paddingBottom);
  const colorFor = (value: number) =>
    value < lowValue ? '#3B82F6' : value > highValue ? '#EF4444' : '#10B981';
  const points = measurements.map((item, index) => {
    const x =
      paddingLeft +
      (index / (measurements.length - 1)) *
        (width - paddingLeft - paddingRight);
    const y = yFor(item.value);
    return { x, y };
  });
  return (
    <View
      style={[styles.chart, { width: maxChartWidth }]}
      testID="biomarker-chart"
      accessibilityLabel="Biomarker values over time"
      onLayout={(event) =>
        setChartWidth(
          Math.max(
            1,
            Math.min(maxChartWidth, event.nativeEvent.layout.width) - 24
          )
        )
      }
    >
      <View style={{ width, height }}>
        {/* eslint-disable @typescript-eslint/no-deprecated -- These x/y props position SVG geometry, not deprecated View transforms. */}
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Rect
            x={paddingLeft}
            y={yFor(lowValue)}
            width={width - paddingLeft - paddingRight}
            height={yFor(min) - yFor(lowValue)}
            fill="#3B82F6"
            opacity={0.1}
          />
          <Rect
            x={paddingLeft}
            y={yFor(highValue)}
            width={width - paddingLeft - paddingRight}
            height={yFor(lowValue) - yFor(highValue)}
            fill="#10B981"
            opacity={0.1}
          />
          <Rect
            x={paddingLeft}
            y={paddingTop}
            width={width - paddingLeft - paddingRight}
            height={yFor(highValue) - paddingTop}
            fill="#EF4444"
            opacity={0.1}
          />
          <Line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke={COLORS.light.border}
            strokeWidth="1"
          />
          <Line
            x1={paddingLeft}
            y1={yFor(highValue)}
            x2={width - paddingRight}
            y2={yFor(highValue)}
            stroke="#EF4444"
            strokeWidth="1"
            strokeDasharray="4,4"
            strokeOpacity={1}
          />
          <Line
            x1={paddingLeft}
            y1={yFor(lowValue)}
            x2={width - paddingRight}
            y2={yFor(lowValue)}
            stroke="#3B82F6"
            strokeWidth="1"
            strokeDasharray="4,4"
            strokeOpacity={1}
          />
          <Line
            x1={paddingLeft}
            y1={yFor(min)}
            x2={width - paddingRight}
            y2={yFor(min)}
            stroke={COLORS.light.border}
            strokeWidth="1"
          />
          <SvgText
            x={paddingLeft - 8}
            y={yFor(highValue) - 4}
            fill="#EF4444"
            fontSize="12"
            textAnchor="end"
            fillOpacity={1}
          >
            High
          </SvgText>
          <SvgText
            x={paddingLeft - 8}
            y={yFor(highValue) + 12}
            fill="#EF4444"
            fontSize="12"
            textAnchor="end"
            fillOpacity={1}
          >
            {highValue}
          </SvgText>
          <SvgText
            x={paddingLeft - 8}
            y={yFor(lowValue) - 4}
            fill="#3B82F6"
            fontSize="12"
            textAnchor="end"
            fillOpacity={1}
          >
            Low
          </SvgText>
          <SvgText
            x={paddingLeft - 8}
            y={yFor(lowValue) + 12}
            fill="#3B82F6"
            fontSize="12"
            textAnchor="end"
            fillOpacity={1}
          >
            {lowValue}
          </SvgText>
          <Polyline
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke="#000000"
            strokeWidth="0.75"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map(({ x, y }, index) => (
            <React.Fragment key={measurements[index].id}>
              <Circle
                cx={x}
                cy={y}
                r="6"
                fill={colorFor(measurements[index].value)}
              />
              <SvgText
                x={x}
                y={height - 34}
                fill={COLORS.light.mutedForeground}
                fontSize="10"
                textAnchor="middle"
              >
                {formatDisplayDate(measurements[index].date).split(', ')[0]}
              </SvgText>
              <SvgText
                x={x}
                y={height - 20}
                fill={COLORS.light.mutedForeground}
                fontSize="10"
                textAnchor="middle"
              >
                {formatDisplayDate(measurements[index].date).split(', ')[1]}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
        {/* eslint-enable @typescript-eslint/no-deprecated */}
        {points.map((point, index) => (
          <Pressable
            key={measurements[index].id}
            testID={`biomarker-point-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${formatDisplayDate(measurements[index].date)}: ${measurements[index].value} ${measurements[index].unit}`}
            onHoverIn={() => setHoveredIndex(index)}
            onHoverOut={() => setHoveredIndex(null)}
            onPressIn={() => setHoveredIndex(index)}
            onPressOut={() => setHoveredIndex(null)}
            style={[
              styles.pointHitTarget,
              { left: point.x - 12, top: point.y - 12 },
            ]}
          />
        ))}
        {hoveredIndex !== null && (
          <View
            pointerEvents="none"
            testID="biomarker-tooltip"
            style={[
              styles.tooltip,
              {
                left: Math.min(
                  Math.max(points[hoveredIndex].x - 90, 0),
                  width - 180
                ),
                top: Math.max(points[hoveredIndex].y - 58, 0),
              },
            ]}
          >
            <Text style={styles.tooltipDate}>
              {formatDisplayDate(measurements[hoveredIndex].date)}
            </Text>
            <View style={styles.tooltipMeasurement}>
              <Text style={styles.tooltipValue}>
                {measurements[hoveredIndex].value}
              </Text>
              <Text style={styles.tooltipUnit}>
                {measurements[hoveredIndex].unit}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pointHitTarget: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    minWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.light.foreground,
  },
  tooltipMeasurement: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  tooltipDate: { color: '#ffffff', fontSize: 12, marginBottom: 3 },
  tooltipValue: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  tooltipUnit: { color: '#ffffff', fontSize: 12, fontWeight: '400' },
  latestSection: { marginBottom: 20 },
  latestValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  latestValue: {
    color: COLORS.light.foreground,
    fontSize: 24,
    fontWeight: '700',
  },
  learnItem: { marginBottom: 0 },
  learnItemExpanded: { marginBottom: 18 },
  historyListToggle: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  historyListContainer: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'flex-start',
  },
  historyListTitle: {
    color: COLORS.light.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  learnItemToggle: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  learnItemTitle: {
    color: COLORS.light.foreground,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  learnChevronBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  learnChevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  learnText: {
    color: COLORS.light.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  learnNote: {
    color: COLORS.light.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  section: { marginBottom: 28 },
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
  chart: {
    maxWidth: 600,
    marginHorizontal: -6,
    borderRadius: 16,
    padding: 12,
    backgroundColor: COLORS.light.card,
    marginBottom: 16,
  },
  history: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.border,
  },
  historyRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.border,
  },
  historyDate: { color: COLORS.light.textSecondary, fontSize: 14 },
  valueGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  historyValueColumn: { alignItems: 'flex-end', gap: 8 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusLow: { backgroundColor: COLORS.light.badgeLowBg },
  statusNormal: { backgroundColor: COLORS.light.badgeNormalBg },
  statusHigh: { backgroundColor: COLORS.light.badgeHighBg },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextLow: { color: COLORS.light.badgeLowText },
  statusTextNormal: { color: COLORS.light.badgeNormalText },
  statusTextHigh: { color: COLORS.light.badgeHighText },
  historyValue: {
    color: COLORS.light.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  unit: { color: COLORS.light.mutedForeground, fontSize: 12 },
});
