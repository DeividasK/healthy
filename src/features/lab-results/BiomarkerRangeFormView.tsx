import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormField } from '@/src/components/FormField';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { FormActionDock } from '@/src/components/FormActionDock';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { LoadingView } from '@/src/components/LoadingView';
import { useHasChanges } from '@/src/components/useHasChanges';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import {
  getProfileSettings,
  saveProfileSettings,
} from '@/src/features/settings/profileSettingsRepository';
import {
  BIOMARKERS,
  getBiomarkerKey,
  hasLoincCode,
} from '@/src/data/biomarkers';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { goBackOr } from '@/src/utils/navigation';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN } from '@/src/theme/layout';
import {
  hasLimits,
  isWrittenLimit,
  type BiomarkerRangeEntry,
} from './biomarkerRanges';

/** A limit as written, with a decimal comma as a point; empty is none. */
const writtenLimit = (text: string) => {
  const limit = text.trim().replace(',', '.');
  return limit === '' ? undefined : limit;
};

/** Why limits don't make a range: the optimal part must lie inside it. */
function rangeError({
  low,
  high,
  optimalLow,
  optimalHigh,
}: Pick<BiomarkerRangeEntry, LimitKey>) {
  const [lower, upper, optimalFrom, optimalTo] = [
    low,
    high,
    optimalLow,
    optimalHigh,
  ].map((limit) => (limit === undefined ? undefined : Number(limit)));
  const below = (a?: number, b?: number) =>
    a === undefined || b === undefined || a < b;
  const notBelow = (a?: number, b?: number) =>
    a === undefined || b === undefined || a >= b;
  if (!below(lower, upper))
    return 'The upper limit must be above the lower limit.';
  if (!below(optimalFrom, optimalTo))
    return 'The optimal range must end above where it starts.';
  if (
    !notBelow(optimalFrom, lower) ||
    !notBelow(upper, optimalTo) ||
    !below(optimalFrom, upper) ||
    !below(lower, optimalTo)
  )
    return 'The optimal range must be inside the lower and upper limits.';
  return undefined;
}

const LIMITS = [
  { key: 'low', label: 'Lower limit' },
  { key: 'high', label: 'Upper limit' },
  { key: 'optimalLow', label: 'Optimal from' },
  { key: 'optimalHigh', label: 'Optimal to' },
] as const;
type LimitKey = (typeof LIMITS)[number]['key'];

/**
 * Sets a biomarker's range from a date, like changing a treatment's usage:
 * its limits and, if the user wants one, an optimal part. Opened from the
 * biomarker page's dock, in the unit the page shows (`unit`, `unitLabel`).
 * With a `since` param, edits the range the user set that day, or removes it.
 */
export function BiomarkerRangeFormView() {
  const router = useRouter();
  const { id, unit, unitLabel, since } = useLocalSearchParams<{
    id: string;
    unit: string;
    unitLabel?: string;
    since?: string;
  }>();
  const { activePatientId } = useActivePatient();
  const marker = BIOMARKERS.find(
    (candidate) => candidate.id === id || hasLoincCode(candidate, id)
  );
  const key = marker ? getBiomarkerKey(marker) : id;
  const [stored, setStored] = useState<BiomarkerRangeEntry[] | null>(null);
  const editing = stored?.find(
    (entry) => entry.source === 'user' && entry.since === since
  );
  const [date, setDate] = useState(() => {
    if (!since) return new Date();
    const [year, month, day] = since.split('-').map(Number);
    return new Date(year, month - 1, day);
  });
  const [values, setValues] = useState<Record<LimitKey, string>>({
    low: '',
    high: '',
    optimalLow: '',
    optimalHigh: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = useHasChanges({ date, values });

  useEffect(() => {
    if (!activePatientId) return;
    void getProfileSettings(activePatientId).then((settings) => {
      const entries = settings.biomarkerRanges?.[key] ?? [];
      setStored(entries);
      const entry = entries.find(
        (candidate) => candidate.source === 'user' && candidate.since === since
      );
      if (entry)
        setValues({
          low: entry.low ?? '',
          high: entry.high ?? '',
          optimalLow: entry.optimalLow ?? '',
          optimalHigh: entry.optimalHigh ?? '',
        });
    });
  }, [activePatientId, key, since]);

  const back = () => goBackOr(router, `/biomarker/${id}`);
  /** Stores the user's ranges for this biomarker, replacing the old list. */
  const store = async (entries: BiomarkerRangeEntry[]) => {
    const settings = await getProfileSettings(activePatientId!);
    await saveProfileSettings(activePatientId!, {
      biomarkerRanges: { ...settings.biomarkerRanges, [key]: entries },
    });
  };

  const handleSave = async () => {
    const range = Object.fromEntries(
      LIMITS.map(({ key: limit }) => [limit, writtenLimit(values[limit])])
    ) as Pick<BiomarkerRangeEntry, LimitKey>;
    if (!hasLimits(range)) {
      setErrorMessage('Enter a lower or an upper limit.');
      return;
    }
    if (
      Object.values(range).some(
        (limit) => limit !== undefined && !isWrittenLimit(limit)
      )
    ) {
      setErrorMessage('Limits must be numbers, like 3.5.');
      return;
    }
    const error = rangeError(range);
    if (error) {
      setErrorMessage(error);
      return;
    }
    try {
      setIsSaving(true);
      const entry: BiomarkerRangeEntry = {
        ...range,
        unit: editing?.unit ?? unit,
        since: formatLocalDate(date),
        source: 'user',
      };
      await store([
        ...(stored ?? []).filter(
          (other) => other !== editing && other.since !== formatLocalDate(date)
        ),
        entry,
      ]);
      back();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (!stored) return <LoadingView />;
  const name = marker?.name ?? id;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="biomarker-range-form"
      >
        <ScreenHeading testID="biomarker-range-form-title">
          {editing ? `Edit range: ${name}` : `Set range: ${name}`}
        </ScreenHeading>
        {errorMessage && (
          <FormErrorBanner
            message={errorMessage}
            testID="biomarker-range-form-error"
          />
        )}
        <FormField label="From" nativeID="biomarker-range-date-input" required>
          <NativeDatePicker
            value={date}
            onChange={(picked) => {
              if (picked) setDate(picked);
            }}
            testID="biomarker-range-date-picker"
            id="biomarker-range-date-input"
            name="rangeDate"
            variant="input"
          />
        </FormField>
        <Text style={styles.hint}>
          In {unitLabel ?? unit}, as printed on your lab report. Leave a limit
          empty if it gives only one.
        </Text>
        {[LIMITS.slice(0, 2), LIMITS.slice(2)].map((pair) => (
          <View key={pair[0].key} style={styles.fieldRow}>
            {pair.map(({ key: limit, label }) => (
              <FormField
                key={limit}
                label={label}
                nativeID={`biomarker-range-${limit}`}
                style={styles.field}
                inputProps={{
                  value: values[limit],
                  onChangeText: (text) =>
                    setValues((current) => ({ ...current, [limit]: text })),
                  inputMode: 'decimal',
                  testID: `biomarker-range-${limit}`,
                }}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <FormActionDock
        saveLabel={editing ? 'Save changes' : 'Set range'}
        onSave={handleSave}
        isSaving={isSaving}
        hasChanges={hasChanges}
        saveTestID="save-range-button"
        {...(editing && {
          onDelete: async () => {
            await store(stored.filter((other) => other !== editing));
            back();
          },
          deleteLabel: 'Remove range',
          deleteTestID: 'biomarker-range-remove-button',
        })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.light.background },
  scrollContent: { ...CONTENT_COLUMN, padding: 20, paddingBottom: 120 },
  hint: {
    color: COLORS.light.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, width: 'auto' },
});
