import React, { useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { ArrowLeft, Check } from 'lucide-react-native';
import { FormField } from '@/src/components/FormField';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { createOrUpdatePatient } from '@/src/features/profile/patientService';
import { COLORS } from '@/src/theme/colors';
import { OnboardingButton } from './OnboardingButton';
import { requestLogoBeat } from './logoHandoff';
import { slideIn } from './motion';

/** How long the saved tick shows before Home. */
const SAVED_PAUSE_MS = 420;

/** First-run setup: the only question is what to call the person. */
export function NameView() {
  const router = useRouter();
  const { patients, setActivePatientId, refreshPatients } = useActivePatient();
  const [givenName, setGivenName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A profile made elsewhere (or this one, once saved) means setup is done.
  if (patients.length > 0 && !saving) return <Redirect href="/" />;

  const canSave = givenName.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const created = await createOrUpdatePatient({ givenName });
      if (created.id) await setActivePatientId(created.id);
      await refreshPatients();
      requestLogoBeat();
      setTimeout(() => router.replace('/'), SAVED_PAUSE_MS);
    } catch (err) {
      console.error('Failed to create profile:', err);
      setError('Could not save your name. Please try again.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.Text
          entering={slideIn(160)}
          accessibilityRole="header"
          style={styles.title}
          testID="welcome-name-title"
        >
          What should we call you?
        </Animated.Text>
        <Animated.Text entering={slideIn(240)} style={styles.subtitle}>
          A first name is enough. You can add more later in your profile.
        </Animated.Text>
        <Animated.View entering={slideIn(320)}>
          <FormField
            label="Name"
            required
            nativeID="welcome-name-input"
            error={error}
            inputProps={{
              testID: 'welcome-name-input',
              id: 'welcome-name-input',
              nativeID: 'welcome-name-input',
              name: 'welcomeName',
              autoFocus: true,
              autoComplete: 'given-name',
              autoCapitalize: 'words',
              placeholder: 'e.g. Jane',
              value: givenName,
              onChangeText: setGivenName,
              onSubmitEditing: save,
              returnKeyType: 'done',
              editable: !saving,
            }}
          />
        </Animated.View>
      </ScrollView>
      <View style={styles.actions}>
        <TouchableOpacity
          testID="welcome-name-back"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
          activeOpacity={0.7}
          disabled={saving}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/welcome')
          }
        >
          <ArrowLeft size={22} color={COLORS.light.iconMuted} />
        </TouchableOpacity>
        <View style={styles.continue}>
          <OnboardingButton
            label="Continue"
            onPress={save}
            disabled={!canSave && !saving}
            done={saving}
            doneIcon={Check}
            testID="welcome-name-continue"
          />
        </View>
      </View>
      {saving && (
        <Text style={styles.srOnly} accessibilityLiveRegion="polite">
          Saved
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  back: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continue: {
    flex: 1,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
