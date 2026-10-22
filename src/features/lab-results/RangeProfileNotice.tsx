import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ModalButton } from '@/src/components/CenteredModal';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import type { MissingDemographic } from './referenceRanges';

const FIELD_LABELS: Record<MissingDemographic, string> = {
  sex: 'gender',
  age: 'date of birth',
};

/** Profile form fields to show for missing details, as its `show` param. */
const PROFILE_FIELDS: Record<MissingDemographic, string> = {
  sex: 'gender',
  age: 'birthDate',
};

/**
 * Asks for the gender and date of birth that results' ranges depend on, and
 * opens the profile form with those fields shown. Renders nothing when the
 * profile has them.
 */
export function RangeProfileNotice({
  missing,
  testID = 'range-profile-notice',
  style,
}: {
  missing: MissingDemographic[];
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const { activePatientId } = useActivePatient();
  if (missing.length === 0 || !activePatientId) return null;
  const fields = missing.map((field) => FIELD_LABELS[field]).join(' and ');

  return (
    <View
      style={[styles.notice, style]}
      testID={testID}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>
        Typical ranges for some results depend on your {fields}. Add your{' '}
        {fields} to your profile to compare your results with the right ranges.
      </Text>
      <View style={styles.action}>
        <ModalButton
          label={`Add ${fields}`}
          testID={`${testID}-button`}
          onPress={() =>
            router.push({
              pathname: '/profile/[id]/edit',
              params: {
                id: activePatientId,
                show: missing.map((field) => PROFILE_FIELDS[field]).join(','),
              },
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.foreground,
  },
  action: {
    alignItems: 'flex-start',
  },
});
