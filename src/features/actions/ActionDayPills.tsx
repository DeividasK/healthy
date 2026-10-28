import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import { DayStatusMark } from './DayStatusMark';
import {
  ACTION_WINDOW_DAYS,
  addDays,
  daysBetween,
  formatDayLabel,
  formatDayOfMonth,
  formatLongDate,
  formatWeekday,
  getStripAnchor,
  getStripEnd,
  STRIP_DAYS,
  DAY_STATUS_LABELS,
  getDayStatus,
  type ActionDay,
} from './actionDays';

const PILL_GAP = 6;
/** How long the outline and the strip take to slide to another day. */
const SLIDE_MS = 440;
/** The calendar pill comes first, then the days. */
const ITEM_COUNT = STRIP_DAYS + 1;

/**
 * Day arrows around a label that opens the calendar, over a strip of the last
 * 21 days that scrolls sideways, led by a pill that opens the calendar too.
 */
export function ActionDayPills({
  daysByDate,
  selected,
  today,
  onSelect,
  onOpenCalendar,
  leading,
  keysEnabled = true,
}: {
  daysByDate: Record<string, ActionDay>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  onOpenCalendar: () => void;
  /** Shown left of the day navigation, e.g. a toggle for the whole view. */
  leading?: React.ReactNode;
  /** Whether Left/Right and A/D step between days, e.g. not while a dialog is open. */
  keysEnabled?: boolean;
}) {
  const [width, setWidth] = useState(0);
  // The strip's last day. It moves only when the selection leaves the strip
  // (a day picked from the calendar, or today), never from the arrows.
  const [anchor, setAnchor] = useState(() => getStripAnchor(selected, today));
  const oldest = addDays(anchor, 1 - STRIP_DAYS);
  if (selected < oldest || selected > anchor)
    setAnchor(getStripAnchor(selected, today));
  const isFirst = selected <= oldest;
  const isLast = selected >= anchor;
  // Before the strip's first day, the calendar offers older days.
  const goBack = () =>
    isFirst ? onOpenCalendar() : onSelect(addDays(selected, -1));
  const goForward = () => {
    if (!isLast) onSelect(addDays(selected, 1));
  };
  useDayKeys(goBack, goForward, keysEnabled);
  return (
    <View style={styles.container}>
      <View style={styles.navigation}>
        {Boolean(leading) && <View style={styles.leading}>{leading}</View>}
        <TouchableOpacity
          testID="actions-previous-day"
          accessibilityRole="button"
          // Before the strip's first day, the calendar offers older days.
          accessibilityLabel={isFirst ? 'Open calendar' : 'Previous day'}
          style={styles.arrow}
          activeOpacity={0.6}
          onPress={goBack}
        >
          <ChevronLeft color={COLORS.light.foreground} size={20} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="actions-day-label"
          accessibilityRole="button"
          accessibilityLabel={`${getDayName(selected, today)}, open calendar`}
          style={styles.label}
          activeOpacity={0.6}
          onPress={onOpenCalendar}
        >
          <Text style={styles.labelText}>
            {formatDayLabel(selected, today)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="actions-next-day"
          accessibilityRole="button"
          accessibilityLabel="Next day"
          accessibilityState={{ disabled: isLast }}
          disabled={isLast}
          style={[styles.arrow, isLast && styles.disabled]}
          activeOpacity={0.6}
          onPress={goForward}
        >
          <ChevronRight color={COLORS.light.foreground} size={20} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="actions-today-button"
          accessibilityRole="button"
          accessibilityLabel={`Go to today, ${formatLongDate(today)}`}
          style={styles.todayButton}
          activeOpacity={0.6}
          onPress={() => onSelect(today)}
        >
          {/* Today's date in a calendar square, like calendar apps show it. */}
          <View style={styles.todayIcon}>
            <Text style={styles.todayText}>{formatDayOfMonth(today)}</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View
        style={styles.strip}
        accessibilityRole="radiogroup"
        accessibilityLabel="Day"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <DayStrip
            width={width}
            anchor={anchor}
            daysByDate={daysByDate}
            selected={selected}
            today={today}
            onSelect={onSelect}
            onOpenCalendar={onOpenCalendar}
          />
        )}
      </View>
    </View>
  );
}

/** Keys that step a day back or forward (web). */
const BACK_KEYS = ['ArrowLeft', 'a', 'A'];
const FORWARD_KEYS = ['ArrowRight', 'd', 'D'];

/**
 * Steps between days on Left/Right and A/D while the screen is focused,
 * except while typing or with a modifier held.
 */
function useDayKeys(back: () => void, forward: () => void, enabled: boolean) {
  const isFocused = useIsFocused();
  const handlers = useRef({ back, forward });
  useEffect(() => {
    handlers.current = { back, forward };
  });
  useEffect(() => {
    if (!enabled || !isFocused || Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      )
        return;
      if (BACK_KEYS.includes(event.key)) handlers.current.back();
      else if (FORWARD_KEYS.includes(event.key)) handlers.current.forward();
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, isFocused]);
}

/**
 * 7 pills in view. The view keeps the selected day in the middle (or as far
 * right as today allows), so stepping a day slides the whole strip by one
 * day. The outline lives inside the strip's content, so it scrolls with the
 * days and slides from day to day on its own. A day older than the strip has
 * no outline and shows the strip from its start.
 */
function DayStrip({
  width,
  anchor,
  daysByDate,
  selected,
  today,
  onSelect,
  onOpenCalendar,
}: {
  width: number;
  /** The strip's last day. */
  anchor: string;
  daysByDate: Record<string, ActionDay>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  onOpenCalendar: () => void;
}) {
  const step = width / ACTION_WINDOW_DAYS;
  const oldest = addDays(anchor, 1 - STRIP_DAYS);
  const isInStrip = selected >= oldest && selected <= anchor;
  const itemOf = (date: string) => 1 + daysBetween(oldest, date);
  const selectedItem = isInStrip ? itemOf(selected) : -1;
  const startIndex = Math.min(
    ITEM_COUNT - ACTION_WINDOW_DAYS,
    Math.max(0, itemOf(getStripEnd(selected, anchor)) - ACTION_WINDOW_DAYS + 1)
  );

  const listRef = useRef<FlatList<number>>(null);
  const offset = useRef(startIndex * step);
  const shownStart = useRef(startIndex);
  const shownSelected = useRef(selectedItem);
  const shownAnchor = useRef(anchor);
  // The outline's place in the strip's content, in pixels.
  const [outlineX] = useState(
    () => new Animated.Value(Math.max(0, selectedItem) * step)
  );
  // Scrolls the strip frame by frame, so it slides as slowly as the outline.
  const [scrollDrive] = useState(() => new Animated.Value(startIndex * step));

  useEffect(() => {
    const id = scrollDrive.addListener(({ value }) =>
      listRef.current?.scrollToOffset({ offset: value, animated: false })
    );
    return () => scrollDrive.removeListener(id);
  }, [scrollDrive]);

  useEffect(() => {
    if (shownAnchor.current === anchor) return;
    // Other days fill the strip: show them in place, without sliding.
    shownAnchor.current = anchor;
    shownStart.current = startIndex;
    shownSelected.current = selectedItem;
    scrollDrive.stopAnimation();
    outlineX.stopAnimation();
    outlineX.setValue(Math.max(0, selectedItem) * step);
    offset.current = startIndex * step;
    listRef.current?.scrollToOffset({
      offset: offset.current,
      animated: false,
    });
  }, [anchor, startIndex, selectedItem, step, scrollDrive, outlineX]);

  useEffect(() => {
    if (shownStart.current === startIndex) return;
    shownStart.current = startIndex;
    scrollDrive.setValue(offset.current);
    Animated.timing(scrollDrive, {
      toValue: startIndex * step,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [startIndex, step, scrollDrive]);

  useEffect(() => {
    const previous = shownSelected.current;
    if (previous === selectedItem) return;
    shownSelected.current = selectedItem;
    const target = selectedItem * step;
    // Entering the strip from an older day places the outline at once.
    if (previous < 0 || selectedItem < 0) {
      outlineX.setValue(Math.max(0, target));
      return;
    }
    Animated.timing(outlineX, {
      toValue: target,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [selectedItem, step, outlineX]);

  const pillWidth = step - PILL_GAP;
  return (
    <FlatList
      ref={listRef}
      testID="actions-week-pager"
      data={Array.from({ length: ITEM_COUNT }, (_, index) => index)}
      keyExtractor={(index) => String(index)}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      initialScrollIndex={startIndex}
      getItemLayout={(_, index) => ({
        length: step,
        offset: step * index,
        index,
      })}
      initialNumToRender={ITEM_COUNT}
      windowSize={ITEM_COUNT}
      // Android detaches subviews it deems off-screen, and the outline's layer
      // sits at the strip's start, so it would vanish once the strip scrolls.
      removeClippedSubviews={false}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={16}
      // Dragging takes over from a slide in progress.
      onScrollBeginDrag={() => scrollDrive.stopAnimation()}
      // Positioned over the days without taking space in the list.
      ListHeaderComponentStyle={styles.outlineLayer}
      ListHeaderComponent={
        isInStrip ? (
          <Animated.View
            testID="actions-day-highlight"
            style={[
              styles.outline,
              { width: pillWidth, transform: [{ translateX: outlineX }] },
            ]}
          />
        ) : null
      }
      extraData={anchor}
      renderItem={({ item: index }) => (
        <View style={[styles.cell, { width: step }]}>
          {index === 0 ? (
            <Pressable
              testID="actions-open-calendar"
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
              style={[styles.pill, { width: pillWidth }]}
              onPress={onOpenCalendar}
            >
              <CalendarDays color={COLORS.light.iconMuted} size={22} />
            </Pressable>
          ) : (
            <DayPill
              date={addDays(oldest, index - 1)}
              day={daysByDate[addDays(oldest, index - 1)]}
              isSelected={index === selectedItem}
              isToday={addDays(oldest, index - 1) === today}
              width={pillWidth}
              onSelect={onSelect}
            />
          )}
        </View>
      )}
    />
  );
}

function DayPill({
  date,
  day,
  isSelected,
  isToday,
  width,
  onSelect,
}: {
  date: string;
  day?: ActionDay;
  isSelected: boolean;
  isToday: boolean;
  width: number;
  onSelect: (date: string) => void;
}) {
  const status = day ? getDayStatus(day) : 'future';
  // No press feedback: the outline moving to the day is the response.
  return (
    <Pressable
      testID={`actions-day-${date}`}
      accessibilityRole="radio"
      accessibilityLabel={`${formatLongDate(date)}: ${DAY_STATUS_LABELS[status]}`}
      aria-checked={isSelected}
      accessibilityState={{ checked: isSelected }}
      style={[styles.pill, { width }]}
      onPress={() => onSelect(date)}
    >
      <Text style={styles.weekday}>{formatWeekday(date)}</Text>
      <Text style={styles.dayOfMonth}>{formatDayOfMonth(date)}</Text>
      {day ? (
        <DayStatusMark
          status={status}
          isToday={isToday}
          size={20}
          testID={`actions-day-${date}-${status}`}
        />
      ) : (
        // A day still loading keeps the mark's space without a placeholder.
        <View style={styles.markSlot} />
      )}
    </Pressable>
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
  // Beside the centred day navigation, not part of it.
  leading: {
    position: 'absolute',
    left: 0,
  },
  todayButton: {
    position: 'absolute',
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.light.iconMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.light.iconMuted,
  },
  label: {
    minWidth: 120,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.light.foreground,
  },
  strip: {
    height: 92,
    overflow: 'hidden',
  },
  cell: {
    height: 92,
    alignItems: 'center',
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: COLORS.light.pillBackground,
  },
  markSlot: {
    width: 20,
    height: 20,
  },
  outlineLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  outline: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: PILL_GAP / 2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.light.primary,
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

/**
 * The day label's text, then the full date when the label is relative, e.g.
 * "Today, Tuesday, October 27". Voice control users say what they see, so
 * the name starts with it (WCAG 2.5.3, label in name).
 */
function getDayName(date: string, today: string): string {
  const label = formatDayLabel(date, today);
  return label === 'Today' || label === 'Yesterday'
    ? `${label}, ${formatLongDate(date)}`
    : label;
}
