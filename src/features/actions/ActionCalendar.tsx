import React, { useEffect, useState } from 'react';
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
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import { DayStatusMark } from './DayStatusMark';
import {
  DAY_STATUS_LABELS,
  addMonths,
  formatLongDate,
  formatMonth,
  getDayStatus,
  getMonthGrid,
  type ActionDay,
  type DayStatus,
} from './actionDays';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Every day mark, explained under the month. */
const LEGEND: DayStatus[] = ['complete', 'partial', 'empty', 'none', 'future'];

const SLIDE_MS = 260;

/**
 * A month of days, each marked like the day pills, to jump to any day up to
 * today. It slides down from under the header over a dimmed screen and opens
 * on the selected day's month.
 */
export function ActionCalendar({
  selected,
  today,
  loadDays,
  onSelect,
  onClose,
}: {
  selected: string;
  today: string;
  loadDays: (dates: string[]) => Promise<ActionDay[]>;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(selected.slice(0, 7));
  const [daysByDate, setDaysByDate] = useState<Record<string, ActionDay>>({});
  const grid = getMonthGrid(month);
  const isCurrentMonth = month >= today.slice(0, 7);
  const [panelHeight, setPanelHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));

  const slide = (toValue: number, done?: () => void) =>
    Animated.timing(progress, {
      toValue,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(done);
  const close = (then?: () => void) =>
    slide(0, () => {
      onClose();
      then?.();
    });

  useEffect(() => {
    if (panelHeight) slide(1);
    // Slides in once, when the panel's height is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelHeight]);

  useEffect(() => {
    let active = true;
    // The month before too, so paging back usually finds its marks ready.
    const dates = [
      ...getMonthGrid(addMonths(month, -1)),
      ...getMonthGrid(month),
    ].filter((date): date is string => date !== null && date <= today);
    loadDays(dates)
      .then((days) => {
        if (!active) return;
        setDaysByDate((current) => {
          const next = { ...current };
          for (const day of days) next[day.date] = day;
          return next;
        });
      })
      .catch((err) => console.error('Failed to load calendar days:', err));
    return () => {
      active = false;
    };
  }, [month, today, loadDays]);

  return (
    <View style={styles.layer}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          testID="actions-calendar-overlay"
          accessibilityRole="button"
          accessibilityLabel="Close calendar"
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
        />
      </Animated.View>
      <Animated.View
        testID="actions-calendar"
        onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
        style={[
          styles.panel,
          {
            // Hidden until measured, then slides out from under the header.
            opacity: panelHeight ? 1 : 0,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-panelHeight, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity
              testID="actions-calendar-previous-month"
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={styles.arrow}
              activeOpacity={0.6}
              onPress={() => setMonth((current) => addMonths(current, -1))}
            >
              <ChevronLeft color={COLORS.light.foreground} size={20} />
            </TouchableOpacity>
            <Text
              style={styles.month}
              accessibilityRole="header"
              testID="actions-calendar-month"
            >
              {formatMonth(month)}
            </Text>
            <TouchableOpacity
              testID="actions-calendar-next-month"
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: isCurrentMonth }}
              disabled={isCurrentMonth}
              style={[styles.arrow, isCurrentMonth && styles.disabled]}
              activeOpacity={0.6}
              onPress={() => setMonth((current) => addMonths(current, 1))}
            >
              <ChevronRight color={COLORS.light.foreground} size={20} />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            {WEEKDAYS.map((weekday) => (
              <Text key={weekday} style={[styles.cell, styles.weekday]}>
                {weekday}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {grid.map((date, index) => {
              if (!date)
                return <View key={`pad-${index}`} style={styles.cell} />;
              const isFuture = date > today;
              const isSelected = date === selected;
              const day = daysByDate[date];
              // Days still loading show an empty circle, like days to come.
              const isLoading = !isFuture && !day;
              const status = isFuture || !day ? 'future' : getDayStatus(day);
              return (
                <Pressable
                  key={date}
                  testID={`actions-calendar-day-${date}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatLongDate(date)}: ${DAY_STATUS_LABELS[status]}`}
                  accessibilityState={{
                    disabled: isFuture,
                    selected: isSelected,
                  }}
                  disabled={isFuture}
                  style={[
                    styles.cell,
                    styles.day,
                    isSelected && styles.selected,
                  ]}
                  onPress={() => close(() => onSelect(date))}
                >
                  <Text style={[styles.dayNumber, isFuture && styles.future]}>
                    {Number(date.slice(8))}
                  </Text>
                  {isLoading ? (
                    // Keeps the mark's space without flashing a placeholder.
                    <View style={styles.markSlot} />
                  ) : (
                    <DayStatusMark
                      status={status}
                      isToday={date === today}
                      size={16}
                      testID={`actions-calendar-day-${date}-${status}`}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.legend} testID="actions-calendar-legend">
            {LEGEND.map((status) => (
              <View key={status} style={styles.legendItem}>
                <DayStatusMark status={status} size={14} />
                <Text style={styles.legendText}>
                  {DAY_STATUS_LABELS[status]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clips the panel at the header's border as it slides out from under it.
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.light.modalBackdrop,
  },
  panel: {
    backgroundColor: COLORS.light.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
  month: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.light.foreground,
  },
  row: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
  },
  weekday: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.mutedForeground,
    paddingVertical: 6,
  },
  day: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
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
  markSlot: {
    width: 16,
    height: 16,
  },
  selected: {
    borderColor: COLORS.light.primary,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  future: {
    color: COLORS.light.muted,
    fontWeight: '400',
  },
});
