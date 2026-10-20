import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock } from 'lucide-react-native';
import {
  AddOptionsModal,
  type AddOptionItem,
} from '@/src/components/AddOptionsModal';
import type { AutocompleteItem } from '@/src/components/AutocompleteDropdown';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { FormActionDock } from '@/src/components/FormActionDock';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { FormField } from '@/src/components/FormField';
import {
  FieldRevealProvider,
  useFieldReveal,
} from '@/src/components/FieldReveal';
import { GroupHeader } from '@/src/components/GroupHeader';
import { LinkedResourcesField } from '@/src/components/LinkedResourcesField';
import { NativeSelect } from '@/src/components/NativeSelect';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { useHasChanges } from '@/src/components/useHasChanges';
import { COLORS } from '@/src/theme/colors';
import {
  OFFERED_WHEN,
  SPECIFIC_TIME,
  getWhenOptions,
} from '@/src/features/treatments/regimen';
import {
  getBundleTimeKey,
  type BundleTime,
  type BundleValues,
  type BundleWhen,
} from './bundleModel';

/** One time in the form: a part of the day, or a specific clock time. */
interface TimeDraft {
  choice: string;
  time: string;
}

const toDraft = (time: BundleTime): TimeDraft =>
  time.kind === 'when'
    ? { choice: time.code, time: '08:00' }
    : { choice: SPECIFIC_TIME, time: time.time };

const fromDraft = (draft: TimeDraft): BundleTime =>
  draft.choice === SPECIFIC_TIME
    ? { kind: 'time', time: draft.time }
    : { kind: 'when', code: draft.choice as BundleWhen };

const newTime = (): TimeDraft => ({ choice: OFFERED_WHEN[0], time: '08:00' });

export function BundleForm({
  initialValues,
  treatmentOptions,
  isEditing = false,
  onSubmit,
}: {
  initialValues?: Partial<BundleValues>;
  /** The active patient's treatments, offered as members. */
  treatmentOptions: AutocompleteItem[];
  isEditing?: boolean;
  onSubmit: (values: BundleValues) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [memberIds, setMemberIds] = useState(initialValues?.memberIds || []);
  const [times, setTimes] = useState<TimeDraft[]>(
    (initialValues?.times || []).map(toDraft)
  );
  const [showTimes, setShowTimes] = useState(times.length > 0);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [timeOptions, setTimeOptions] = useState<AddOptionItem[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasChanges = useHasChanges({ title, memberIds, times });
  const { reveal, scrollViewProps } = useFieldReveal();

  const options: AddOptionItem[] = showTimes
    ? []
    : [
        {
          id: 'times',
          label: 'Times',
          testID: 'menu-add-bundle-times',
          icon: (
            <Clock
              size={20}
              color={COLORS.light.primary}
              style={{ marginRight: 12 }}
            />
          ),
          onPress: () => {
            setTimes([newTime()]);
            setShowTimes(true);
          },
        },
      ];

  const setTime = (index: number, next: TimeDraft) =>
    setTimes((current) =>
      current.map((time, candidate) => (candidate === index ? next : time))
    );

  const handleSubmit = async () => {
    const trimmed = title.trim();
    const bundleTimes = showTimes ? times.map(fromDraft) : [];
    const keys = bundleTimes.map(getBundleTimeKey);
    const error = !trimmed
      ? 'Bundle name is required'
      : !memberIds.length
        ? 'Choose at least one treatment'
        : new Set(keys).size !== keys.length
          ? 'Each time can only be added once'
          : null;
    setErrorMessage(error);
    if (error) return;
    try {
      setIsSubmitting(true);
      await onSubmit({ title: trimmed, memberIds, times: bundleTimes });
    } catch (err: any) {
      console.error('Failed to save bundle:', err);
      setErrorMessage(err.message || 'Failed to save bundle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FieldRevealProvider value={reveal}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          {...scrollViewProps}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          testID="bundle-form"
        >
          <ScreenHeading testID="bundle-form-title">
            {isEditing ? 'Edit Bundle' : 'Add Bundle'}
          </ScreenHeading>
          {errorMessage && (
            <FormErrorBanner
              message={errorMessage}
              testID="bundle-form-error"
            />
          )}
          <FormField
            label="Bundle Name"
            nativeID="bundle-title-input"
            required
            inputProps={{
              id: 'bundle-title-input',
              nativeID: 'bundle-title-input',
              name: 'title',
              testID: 'bundle-title-input',
              autoFocus: !isEditing,
              accessibilityLabel: 'Bundle Name',
              placeholder: 'e.g. Morning supplements',
              value: title,
              onChangeText: (text) => {
                setTitle(text);
                if (errorMessage) setErrorMessage(null);
              },
            }}
          />
          <LinkedResourcesField
            label="Treatments"
            searchLabel="Select treatments"
            options={treatmentOptions}
            selectedIds={memberIds}
            onChange={setMemberIds}
            required
            itemType="treatment"
            idPrefix="bundle-"
            testID="bundle-treatments-field"
          />
          {showTimes && (
            <FormField
              label="Times"
              nativeID="bundle-time-1-select"
              onRemove={() => {
                setShowTimes(false);
                setTimes([]);
              }}
              removeTestID="remove-bundle-times-button"
              testID="bundle-times-field"
            >
              {times.map((time, index) => {
                const idPrefix = `bundle-time-${index + 1}`;
                return (
                  <View key={index} style={styles.time} testID={idPrefix}>
                    <GroupHeader
                      title={`Time ${index + 1}`}
                      titleStyle={styles.timeTitle}
                      idPrefix={idPrefix}
                      onAdd={() =>
                        setTimeOptions([
                          {
                            id: 'another-time',
                            label: 'Another Time',
                            testID: `${idPrefix}-add-time`,
                            icon: (
                              <Clock
                                size={20}
                                color={COLORS.light.primary}
                                style={{ marginRight: 12 }}
                              />
                            ),
                            onPress: () =>
                              setTimes((current) => [
                                ...current.slice(0, index + 1),
                                newTime(),
                                ...current.slice(index + 1),
                              ]),
                          },
                        ])
                      }
                      onRemove={
                        times.length > 1
                          ? () =>
                              setTimes((current) =>
                                current.filter((_, other) => other !== index)
                              )
                          : undefined
                      }
                    />
                    <NativeSelect
                      testID={`${idPrefix}-select`}
                      name={`${idPrefix}-choice`}
                      label={`Time ${index + 1}`}
                      value={time.choice}
                      options={getWhenOptions(time.choice)}
                      onChange={(choice) => setTime(index, { ...time, choice })}
                    />
                    {time.choice === SPECIFIC_TIME && (
                      <NativeTimePicker
                        value={time.time}
                        onChange={(picked) =>
                          setTime(index, { ...time, time: picked })
                        }
                        testID={`${idPrefix}-input`}
                        id={`${idPrefix}-input`}
                        name={`${idPrefix}-time`}
                      />
                    )}
                  </View>
                );
              })}
            </FormField>
          )}
        </ScrollView>
        <FloatingAddMenu
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={options}
          testID="form-add-menu"
        />
        <FormActionDock
          onAdd={() => setShowPlusMenu((visible) => !visible)}
          addExpanded={showPlusMenu}
          addDisabled={!options.length}
          saveLabel={isEditing ? 'Save changes' : 'Save bundle'}
          onSave={handleSubmit}
          isSaving={isSubmitting}
          hasChanges={hasChanges}
          saveTestID="save-bundle-button"
        />
        <AddOptionsModal
          visible={Boolean(timeOptions)}
          onClose={() => setTimeOptions(null)}
          options={timeOptions || []}
          overlayTestID="bundle-time-options-overlay"
          cardTestID="bundle-time-options-menu"
        />
      </SafeAreaView>
    </FieldRevealProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  time: {
    gap: 8,
    marginBottom: 12,
  },
  timeTitle: {
    fontSize: 14,
  },
});
