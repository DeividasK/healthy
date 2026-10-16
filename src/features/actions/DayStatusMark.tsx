import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * A day's logging state: a filled check once every treatment is answered,
 * otherwise an empty circle (outlined in the brand colour when highlighted).
 */
export function DayStatusMark({
  complete,
  highlighted = false,
  size = 28,
  testID,
}: {
  complete: boolean;
  highlighted?: boolean;
  size?: number;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size / 2 },
        complete
          ? styles.complete
          : highlighted
            ? styles.highlighted
            : styles.empty,
      ]}
    >
      {complete && (
        <Check
          color={COLORS.light.primaryForeground}
          size={Math.round(size * 0.6)}
          strokeWidth={3}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  complete: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  empty: {
    backgroundColor: COLORS.light.pillBackground,
    borderColor: COLORS.light.pillBorder,
  },
  highlighted: {
    backgroundColor: COLORS.light.background,
    borderColor: COLORS.light.primary,
  },
});
