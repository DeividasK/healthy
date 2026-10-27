import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormActionDock } from '@/src/components/FormActionDock';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { FormField } from '@/src/components/FormField';
import { GroupHeader } from '@/src/components/GroupHeader';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { useHasChanges } from '@/src/components/useHasChanges';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { PARTS_OF_DAY, type ProfileSettings } from './profileSettings';
import {
  getProfileSettings,
  saveProfileSettings,
} from './profileSettingsRepository';
import { LoadingView } from '@/src/components/LoadingView';
import { CONTENT_COLUMN } from '@/src/theme/layout';
import { getDeviceRangeRegion } from './deviceRangeRegion';
import { RangeRegionField } from './RangeRegionField';

/** The active profile's settings: the clock time of each part of the day. */
export function SettingsView() {
  const { activePatientId, isLoading } = useActivePatient();
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [loadedFor, setLoadedFor] = useState('');

  useEffect(() => {
    if (!activePatientId) return;
    let isMounted = true;
    void getProfileSettings(activePatientId).then((loaded) => {
      if (!isMounted) return;
      setSettings(loaded);
      setLoadedFor(activePatientId);
    });
    return () => {
      isMounted = false;
    };
  }, [activePatientId]);

  if (isLoading || !settings || loadedFor !== activePatientId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <LoadingView />
      </SafeAreaView>
    );
  }
  return (
    <SettingsForm
      key={activePatientId}
      patientId={activePatientId}
      initial={settings}
    />
  );
}

function SettingsForm({
  patientId,
  initial,
}: {
  patientId: string;
  initial: ProfileSettings;
}) {
  const router = useRouter();
  const { variant } = useLocalSearchParams<{ variant?: 'a' | 'b' | 'c' }>();
  const [timesOfDay, setTimesOfDay] = useState(initial.timesOfDay);
  const [deviceRegion] = useState(getDeviceRangeRegion);
  const [rangeRegion, setRangeRegion] = useState(initial.rangeRegion);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChanges = useHasChanges({ timesOfDay, rangeRegion });

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await saveProfileSettings(patientId, { timesOfDay, rangeRegion });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="settings-view"
      >
        <ScreenHeading testID="settings-title">Settings</ScreenHeading>
        {error && <FormErrorBanner message={error} testID="settings-error" />}
        <GroupHeader title="Times of Day" idPrefix="settings-times-of-day" />
        {PARTS_OF_DAY.map(({ code, label }) => {
          const id = `settings-time-${code}`;
          return (
            <FormField key={code} label={label} nativeID={id} required>
              <NativeTimePicker
                value={timesOfDay[code]}
                onChange={(time) =>
                  setTimesOfDay((current) => ({ ...current, [code]: time }))
                }
                testID={id}
                id={id}
                name={`timeOfDay-${code}`}
              />
            </FormField>
          );
        })}
        <RangeRegionField
          value={rangeRegion ?? deviceRegion}
          pickedFromDevice={!rangeRegion}
          onChange={setRangeRegion}
          variant={variant}
        />
      </ScrollView>
      <FormActionDock
        onSave={handleSave}
        isSaving={isSaving}
        hasChanges={hasChanges}
        saveLabel="Save settings"
        saveTestID="save-settings-button"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scrollContent: {
    ...CONTENT_COLUMN,
    padding: 20,
    paddingBottom: 120,
  },
});
