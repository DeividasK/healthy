import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { FormField } from '@/src/components/FormField';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN } from '@/src/theme/layout';

/** Unlocks the synced records in Google Drive with the 24-word phrase. */
export function RestoreVaultView() {
  const router = useRouter();
  const { unlockWithPhrase, startOverWithNewPhrase, setProfileSynced } =
    useSync();
  // `next=pick` comes from "Restore from Google Drive" (choose profiles next);
  // `profile` from a profile's sync card (start syncing that profile).
  const { next, profile } = useLocalSearchParams<{
    next?: string;
    profile?: string;
  }>();
  const [showStartOver, setShowStartOver] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    setError(null);
    try {
      await unlockWithPhrase(phrase);
      if (profile) await setProfileSynced(profile, true);
      if (next === 'pick') router.replace('/profile/restore?pick=1');
      else if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not restore your records.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleStartOver = async () => {
    setShowStartOver(false);
    setIsRestoring(true);
    setError(null);
    try {
      await startOverWithNewPhrase();
      if (profile) await setProfileSynced(profile, true);
      router.replace('/sync/recovery-phrase');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reset Google Drive sync.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeading testID="restore-vault-title">
          Enter recovery phrase
        </ScreenHeading>
        <Text style={styles.description}>
          Your Google Drive already holds encrypted records from another device.
          Enter the 24-word recovery phrase shown when sync was set up to
          decrypt them here.
        </Text>
        <FormField
          label="Recovery phrase"
          nativeID="recovery-phrase-input"
          error={error}
          inputProps={{
            testID: 'recovery-phrase-input',
            id: 'recovery-phrase-input',
            nativeID: 'recovery-phrase-input',
            name: 'recoveryPhrase',
            accessibilityLabel: 'Recovery phrase',
            placeholder: 'word1 word2 word3 …',
            multiline: true,
            numberOfLines: 4,
            autoCapitalize: 'none',
            autoCorrect: false,
            autoComplete: 'off',
            value: phrase,
            onChangeText: setPhrase,
          }}
        />
        <TouchableOpacity
          testID="forgot-recovery-phrase-button"
          onPress={() => setShowStartOver(true)}
          disabled={isRestoring}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={styles.link}>Forgot your recovery phrase?</Text>
        </TouchableOpacity>
      </ScrollView>
      <DeleteConfirmationModal
        visible={showStartOver}
        title="Start over with a new phrase"
        message="Without the recovery phrase, nobody can read the encrypted records in Google Drive. Starting over deletes them from Google Drive and sets up sync with a new phrase. Profiles on this device are kept and uploaded again; your other devices will need the new phrase."
        confirmLabel="Delete and start over"
        requireCountdown
        onConfirm={handleStartOver}
        onCancel={() => setShowStartOver(false)}
        testID="start-over-modal"
      />
      <ResourceActionDock
        actions={[
          {
            label: 'Restore',
            testID: 'restore-vault-button',
            icon: KeyRound,
            primary: true,
            disabled: isRestoring || phrase.trim() === '',
            busy: isRestoring,
            onPress: handleRestore,
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.primary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    ...CONTENT_COLUMN,
    padding: 16,
    paddingBottom: 132,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.muted,
    marginBottom: 20,
  },
});
