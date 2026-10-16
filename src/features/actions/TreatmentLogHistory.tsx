import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
} from 'lucide-react-native';
import { ResourceSection } from '@/src/components/ResourceSection';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { parseLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { getActionDays } from './treatmentLogService';
import { fetchFirstAdministrationDate } from './medicationAdministrationsRepository';
import {
  addMonths,
  formatLongDate,
  getMonthGrid,
  getTreatmentDayStatus,
  todayKey,
  type ActionDay,
  type TreatmentDayStatus,
} from './actionDays';

/** Months shown side by side. */
const MONTHS_SHOWN = 3;
const MONTH_GAP = 16;
const SLIDE_MS = 300;
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** Statuses counted in the legend, in its order. */
const LEGEND: { status: TreatmentDayStatus; label: string }[] = [
  { status: 'taken', label: 'Taken' },
  { status: 'not-taken', label: 'Not taken' },
  { status: 'missing', label: 'Missing' },
];

/** e.g. "Aug '26". */
const formatShortMonth = (month: string) => {
  const date = parseLocalDate(`${month}-01`);
  return `${date.toLocaleDateString('en-US', { month: 'short' })} '${month.slice(2, 4)}`;
};

/**
 * Three months of one treatment's journal answers, one dot per day due:
 * taken, not taken or still missing. The arrows move by a month.
 */
export function TreatmentLogHistory({
  treatmentId,
  patientId,
  isActive,
  startDate,
}: {
  treatmentId: string;
  patientId: string;
  /** Active treatments always show it; others only with answers in view. */
  isActive: boolean;
  /** When the treatment started (`authoredOn`), if known. */
  startDate?: string;
}) {
  const router = useRouter();
  const today = todayKey();
  const [lastMonth, setLastMonth] = useState(today.slice(0, 7));
  const [daysByDate, setDaysByDate] = useState<Record<string, ActionDay>>({});
  const loadSequence = useRef(0);
  const months = Array.from({ length: MONTHS_SHOWN }, (_, index) =>
    addMonths(lastMonth, index - MONTHS_SHOWN + 1)
  );
  // A month either side waits off screen, ready to slide in.
  const stripMonths = [
    addMonths(months[0], -1),
    ...months,
    addMonths(lastMonth, 1),
  ];
  const [width, setWidth] = useState(0);
  const monthWidth = (width - (MONTHS_SHOWN - 1) * MONTH_GAP) / MONTHS_SHOWN;
  const step = monthWidth + MONTH_GAP;
  const [slide] = useState(() => new Animated.Value(0));
  const isSliding = useRef(false);

  // The new months are in place before the next paint, so the strip
  // returns to rest without a jump.
  useLayoutEffect(() => {
    slide.setValue(0);
  }, [lastMonth, slide]);

  /** Slides a month in from the side, then shows the new range. */
  const moveMonth = (delta: 1 | -1) => {
    if (isSliding.current || !width) return;
    isSliding.current = true;
    Animated.timing(slide, {
      toValue: -delta * step,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      isSliding.current = false;
      setLastMonth((month) => addMonths(month, delta));
    });
  };
  const isCurrent = lastMonth >= today.slice(0, 7);
  const [firstLogDate, setFirstLogDate] = useState<string | null>(null);
  // Months before the first one with anything due or logged hold no history.
  // An active treatment without a start date was always due.
  const firstDate = [
    isActive ? startDate?.slice(0, 10) : undefined,
    firstLogDate ?? undefined,
  ]
    .filter((date): date is string => Boolean(date))
    .sort()[0];
  const isFirst =
    !(isActive && !startDate) && months[0] <= (firstDate ?? today).slice(0, 7);

  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const now = todayKey();
    // The months in view and the one either side of them.
    const dates = Array.from({ length: MONTHS_SHOWN + 2 }, (_, index) =>
      getMonthGrid(addMonths(lastMonth, index - MONTHS_SHOWN))
    )
      .flat()
      .filter((date): date is string => date !== null && date <= now);
    try {
      const [days, firstLog] = await Promise.all([
        getActionDays(patientId, dates),
        fetchFirstAdministrationDate(patientId, treatmentId),
      ]);
      if (sequence !== loadSequence.current) return;
      setFirstLogDate(firstLog);
      setDaysByDate((current) => {
        const next = { ...current };
        for (const day of days) next[day.date] = day;
        return next;
      });
    } catch (err) {
      console.error('Failed to load logging history:', err);
    }
  }, [lastMonth, patientId, treatmentId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    ['medication_requests', 'medication_administrations'],
    loadData
  );

  const statusOf = (date: string) =>
    getTreatmentDayStatus(daysByDate[date], treatmentId, date > today);
  const counts = Object.fromEntries(
    LEGEND.map(({ status }) => [
      status,
      months
        .flatMap(getMonthGrid)
        .filter((date) => date && statusOf(date) === status).length,
    ])
  ) as Record<TreatmentDayStatus, number>;

  if (!isActive && !LEGEND.some(({ status }) => counts[status] > 0))
    return null;

  return (
    <ResourceSection
      icon={ListChecks}
      title="Logging history"
      testID="treatment-log-history"
    >
      <View style={styles.body}>
        <View style={styles.navigation}>
          <TouchableOpacity
            testID="treatment-log-history-previous"
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: isFirst }}
            disabled={isFirst}
            style={[styles.arrow, isFirst && styles.disabled]}
            activeOpacity={0.6}
            onPress={() => moveMonth(-1)}
          >
            <ChevronLeft color={COLORS.light.foreground} size={20} />
          </TouchableOpacity>
          <Text style={styles.range} testID="treatment-log-history-range">
            {formatShortMonth(months[0])} – {formatShortMonth(lastMonth)}
          </Text>
          <TouchableOpacity
            testID="treatment-log-history-next"
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: isCurrent }}
            disabled={isCurrent}
            style={[styles.arrow, isCurrent && styles.disabled]}
            activeOpacity={0.6}
            onPress={() => moveMonth(1)}
          >
            <ChevronRight color={COLORS.light.foreground} size={20} />
          </TouchableOpacity>
        </View>

        <View
          style={styles.viewport}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {width > 0 && (
            <Animated.View
              style={[
                styles.months,
                { transform: [{ translateX: Animated.add(slide, -step) }] },
              ]}
            >
              {stripMonths.map((month) => {
                const grid = getMonthGrid(month);
                const taken = grid.filter(
                  (date) => date && statusOf(date) === 'taken'
                ).length;
                return (
                  <View
                    key={month}
                    style={[styles.month, { width: monthWidth }]}
                    testID={`treatment-log-history-${month}`}
                  >
                    <View style={styles.monthHeader}>
                      <Text style={styles.monthName}>
                        {parseLocalDate(`${month}-01`).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                          }
                        )}
                      </Text>
                      <View
                        style={styles.badge}
                        accessible
                        accessibilityLabel={`${taken} days taken`}
                      >
                        <Check color={COLORS.light.primary} size={11} />
                        <Text style={styles.badgeText}>{taken}</Text>
                      </View>
                    </View>
                    <View style={styles.grid}>
                      {WEEKDAY_INITIALS.map((initial, index) => (
                        <Text key={index} style={[styles.cell, styles.weekday]}>
                          {initial}
                        </Text>
                      ))}
                      {grid.map((date, index) => {
                        const status = date ? statusOf(date) : null;
                        const testID =
                          date && status
                            ? `treatment-log-history-day-${date}-${status}`
                            : undefined;
                        const dot = status && (
                          <View style={[styles.dot, dots[status]]} />
                        );
                        // Days that were due open the journal there, to log or
                        // correct them.
                        return date && status && status !== 'upcoming' ? (
                          <Pressable
                            key={date}
                            testID={testID}
                            accessibilityRole="button"
                            accessibilityLabel={`${formatLongDate(date)}: ${
                              LEGEND.find((entry) => entry.status === status)
                                ?.label
                            }, open journal`}
                            style={styles.cell}
                            onPress={() =>
                              router.push({
                                pathname: '/journal',
                                params: { date },
                              })
                            }
                          >
                            {dot}
                          </Pressable>
                        ) : (
                          <View
                            key={date ?? `pad-${index}`}
                            style={styles.cell}
                            testID={testID}
                          >
                            {dot}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          )}
        </View>

        <View style={styles.legend}>
          {LEGEND.map(({ status, label }) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.dot, dots[status]]} />
              <Text style={styles.legendText}>
                {label} ({counts[status]})
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ResourceSection>
  );
}

const DOT = 8;

const dots = StyleSheet.create({
  taken: {
    backgroundColor: COLORS.light.primary,
  },
  // Light enough to stand apart from taken days.
  'not-taken': {
    backgroundColor: COLORS.light.pillBorder,
  },
  missing: {
    borderWidth: 1.5,
    borderColor: COLORS.light.muted,
  },
  upcoming: {
    borderWidth: 1.5,
    borderColor: COLORS.light.pillBorder,
  },
});

const styles = StyleSheet.create({
  body: {
    paddingBottom: 20,
    gap: 16,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  arrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
  range: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.light.foreground,
  },
  // Shows the months in view; the ones either side are clipped.
  viewport: {
    overflow: 'hidden',
  },
  months: {
    flexDirection: 'row',
    gap: MONTH_GAP,
  },
  month: {
    gap: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.light.foreground,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.light.pillBackground,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    fontSize: 10,
    textAlign: 'center',
    color: COLORS.light.mutedForeground,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.light.mutedForeground,
  },
});
