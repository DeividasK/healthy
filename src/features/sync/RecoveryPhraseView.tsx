import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Download } from 'lucide-react-native';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { COLORS } from '@/src/theme/colors';
import { getRecoveryPhrase } from './engine';
import {
  RECOVERY_PHRASE_DESCRIPTION,
  RecoveryPhraseBox,
  saveRecoveryPhraseFile,
} from './RecoveryPhraseBox';

/**
 * Shows the 24-word recovery phrase once, right after sync is set up. Later
 * the profile page shows it in a modal.
 */
export function RecoveryPhraseView() {
  const router = useRouter();
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    getRecoveryPhrase()
      .then((value) => setPhrase(value ?? ''))
      .catch((err) => console.error('Failed to load recovery phrase:', err));
  }, []);

  const handleConfirm = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <ScreenHeading testID="recovery-phrase-title">
          Recovery phrase
        </ScreenHeading>
        <Text style={styles.description}>{RECOVERY_PHRASE_DESCRIPTION}</Text>
        <RecoveryPhraseBox phrase={phrase} />
      </ScrollView>
      <ResourceActionDock
        showBack={false}
        actions={[
          {
            label: 'Download as text file',
            testID: 'recovery-phrase-download-button',
            icon: Download,
            disabled: !phrase,
            onPress: () => saveRecoveryPhraseFile(phrase),
          },
          {
            label: "I've saved it",
            testID: 'recovery-phrase-confirm-button',
            icon: Check,
            primary: true,
            disabled: !phrase,
            onPress: handleConfirm,
          },
        ]}
      />
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
  scrollContent: {
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
