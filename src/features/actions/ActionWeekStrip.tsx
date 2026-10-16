import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';
import { DayStatusMark } from './DayStatusMark';
import {
  formatLongDate,
  formatWeekday,
  DAY_STATUS_LABELS,
  getDayStatus,
  type ActionDay,
} from './actionDays';

/**
 * The homepage's last 7 days, oldest first: each day opens its journal day
 * and shows how far it is logged.
 */
export function ActionWeekStrip({
  days,
  today,
  onOpenDay,
}: {
  days: ActionDay[];
  today: string;
  onOpenDay: (date: string) => void;
}) {
  return (
    <View style={styles.strip} testID="home-actions-week">
      <View style={styles.days}>
        {days.map((day) => {
          const status = getDayStatus(day);
          const isToday = day.date === today;
          return (
            <TouchableOpacity
              key={day.date}
              testID={`home-action-day-${day.date}`}
              accessibilityRole="button"
              accessibilityLabel={`${formatLongDate(day.date)}: ${
                DAY_STATUS_LABELS[status]
              }`}
              style={styles.day}
              activeOpacity={0.6}
              onPress={() => onOpenDay(day.date)}
            >
              <Text style={[styles.weekday, isToday && styles.today]}>
                {formatWeekday(day.date)}
              </Text>
              <DayStatusMark
                status={status}
                highlighted={isToday}
                testID={`home-action-day-${day.date}-${status}`}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  days: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Each day fills its share of the strip, so taps anywhere on it open a day.
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 20,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.mutedForeground,
  },
  today: {
    color: COLORS.light.foreground,
  },
});
