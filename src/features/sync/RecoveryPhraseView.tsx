import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { strToU8 } from 'fflate';
import { Check, Copy, Download } from 'lucide-react-native';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { saveFile } from '@/src/services/fileExport';
import { COLORS } from '@/src/theme/colors';
import { getRecoveryPhrase } from './engine';

const COPIED_FEEDBACK_MS = 2000;

/**
 * Shows the 24-word recovery phrase: once right after sync is set up, and
 * later on request from the sync card.
 */
export function RecoveryPhraseView() {
  const router = useRouter();
  const [phrase, setPhrase] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getRecoveryPhrase()
      .then((value) => setPhrase(value ?? ''))
      .catch((err) => console.error('Failed to load recovery phrase:', err));
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(phrase);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
  };

  const handleDownload = async () => {
    try {
      await saveFile(
        strToU8(
          'Healthy recovery phrase\n\n' +
            'Anyone with these 24 words can read your synced health records. ' +
            'Keep this file private.\n\n' +
            `${phrase}\n`
        ),
        'healthy-recovery-phrase.txt',
        {
          mimeType: 'text/plain',
          dialogTitle: 'Save recovery phrase',
          UTI: 'public.plain-text',
          deleteAfterShare: true,
        }
      );
    } catch (err) {
      console.error('Failed to save recovery phrase:', err);
    }
  };

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
        <Text style={styles.description}>
          Your records are encrypted on this device before they reach Google
          Drive. Write these 24 words down and keep them somewhere safe: you
          need them to sync another device, and nobody can recover your data
          without them.
        </Text>
        <View style={styles.phraseBox}>
          <Text
            testID="recovery-phrase-value"
            nativeID="recovery-phrase-value"
            accessibilityLabel="Recovery phrase"
            style={styles.phrase}
            selectable
          >
            {phrase}
          </Text>
          <TouchableOpacity
            testID="recovery-phrase-copy-button"
            style={styles.copyButton}
            onPress={handleCopy}
            disabled={!phrase}
            accessibilityRole="button"
            accessibilityLabel={
              copied ? 'Recovery phrase copied' : 'Copy recovery phrase'
            }
            activeOpacity={0.7}
          >
            {copied ? (
              <Check size={18} color={COLORS.light.primary} />
            ) : (
              <Copy size={18} color={COLORS.light.foreground} />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <ResourceActionDock
        showBack={false}
        actions={[
          {
            label: 'Download as text file',
            testID: 'recovery-phrase-download-button',
            icon: Download,
            disabled: !phrase,
            onPress: handleDownload,
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
  phraseBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.pillBackground,
    paddingVertical: 14,
    paddingLeft: 16,
    // Leaves room for the copy button in the top-right corner.
    paddingRight: 60,
  },
  phrase: {
    fontSize: 16,
    lineHeight: 28,
    color: COLORS.light.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.background,
  },
});
