import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import { DayStatusMark } from './DayStatusMark';
import {
  formatLongDate,
  formatWeekday,
  isDayComplete,
  type ActionDay,
} from './actionDays';

/**
 * The homepage's last 7 days, oldest first: each day opens its actions and
 * shows a check once every treatment was answered.
 */
export function ActionWeekStrip({
  days,
  today,
  onOpenDay,
  onOpen,
}: {
  days: ActionDay[];
  today: string;
  onOpenDay: (date: string) => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.strip} testID="home-actions-week">
      <View style={styles.days}>
        {days.map((day) => {
          const complete = isDayComplete(day);
          const isToday = day.date === today;
          return (
            <TouchableOpacity
              key={day.date}
              testID={`home-action-day-${day.date}`}
              accessibilityRole="button"
              accessibilityLabel={`${formatLongDate(day.date)}: ${
                complete ? 'all treatments logged' : 'not fully logged'
              }`}
              style={styles.day}
              activeOpacity={0.6}
              onPress={() => onOpenDay(day.date)}
            >
              <Text style={[styles.weekday, isToday && styles.today]}>
                {formatWeekday(day.date)}
              </Text>
              <DayStatusMark
                complete={complete}
                highlighted={isToday}
                testID={`home-action-day-${day.date}-${
                  complete ? 'complete' : 'incomplete'
                }`}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        testID="home-actions-open"
        accessibilityRole="button"
        accessibilityLabel="Open my actions"
        style={styles.chevron}
        activeOpacity={0.6}
        onPress={onOpen}
      >
        <ChevronRight color={COLORS.light.muted} size={18} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  days: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: 8,
    minWidth: 36,
    paddingVertical: 4,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.mutedForeground,
  },
  today: {
    color: COLORS.light.foreground,
  },
  // The negative margin keeps the chevron at the edge, as on resource rows.
  chevron: {
    width: 48,
    height: 48,
    marginRight: -15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
