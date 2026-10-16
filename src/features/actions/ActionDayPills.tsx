import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import { DayStatusMark } from './DayStatusMark';
import {
  addDays,
  formatDayLabel,
  formatDayOfMonth,
  formatLongDate,
  formatWeekday,
  isDayComplete,
  type ActionDay,
} from './actionDays';

/** Day arrows over a row of day pills; the selected pill is outlined. */
export function ActionDayPills({
  days,
  selected,
  today,
  onSelect,
}: {
  days: ActionDay[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const isToday = selected === today;
  return (
    <View style={styles.container}>
      <View style={styles.navigation}>
        <TouchableOpacity
          testID="actions-previous-day"
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          style={styles.arrow}
          activeOpacity={0.6}
          onPress={() => onSelect(addDays(selected, -1))}
        >
          <ChevronLeft color={COLORS.light.foreground} size={20} />
        </TouchableOpacity>
        <Text style={styles.label} testID="actions-day-label">
          {formatDayLabel(selected, today)}
        </Text>
        <TouchableOpacity
          testID="actions-next-day"
          accessibilityRole="button"
          accessibilityLabel="Next day"
          accessibilityState={{ disabled: isToday }}
          disabled={isToday}
          style={[styles.arrow, isToday && styles.disabled]}
          activeOpacity={0.6}
          onPress={() => onSelect(addDays(selected, 1))}
        >
          <ChevronRight color={COLORS.light.foreground} size={20} />
        </TouchableOpacity>
      </View>
      <View
        style={styles.pills}
        accessibilityRole="radiogroup"
        accessibilityLabel="Day"
      >
        {days.map((day) => {
          const isSelected = day.date === selected;
          const complete = isDayComplete(day);
          return (
            <TouchableOpacity
              key={day.date}
              testID={`actions-day-${day.date}`}
              accessibilityRole="radio"
              accessibilityLabel={`${formatLongDate(day.date)}: ${
                complete ? 'all treatments logged' : 'not fully logged'
              }`}
              aria-checked={isSelected}
              accessibilityState={{ checked: isSelected }}
              style={[styles.pill, isSelected && styles.pillSelected]}
              activeOpacity={0.6}
              onPress={() => onSelect(day.date)}
            >
              <Text style={styles.weekday}>{formatWeekday(day.date)}</Text>
              <Text style={styles.dayOfMonth}>
                {formatDayOfMonth(day.date)}
              </Text>
              <DayStatusMark
                complete={complete}
                size={20}
                testID={`actions-day-${day.date}-${
                  complete ? 'complete' : 'incomplete'
                }`}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    gap: 12,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
  label: {
    minWidth: 120,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.light.foreground,
  },
  pills: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  pill: {
    flex: 1,
    maxWidth: 64,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: COLORS.light.pillBackground,
  },
  pillSelected: {
    borderColor: COLORS.light.primary,
    backgroundColor: COLORS.light.background,
  },
  weekday: {
    fontSize: 12,
    color: COLORS.light.mutedForeground,
  },
  dayOfMonth: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
});
