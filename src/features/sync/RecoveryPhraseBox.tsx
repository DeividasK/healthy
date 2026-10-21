import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { strToU8 } from 'fflate';
import { Check, Copy } from 'lucide-react-native';
import { saveFile } from '@/src/services/fileExport';
import { COLORS } from '@/src/theme/colors';

const COPIED_FEEDBACK_MS = 2000;

export const RECOVERY_PHRASE_DESCRIPTION =
  'Your records are encrypted on this device before they reach Google ' +
  'Drive. Write these 24 words down and keep them somewhere safe: you need ' +
  'them to sync another device, and nobody can recover your data without ' +
  'them.';

/** Saves the phrase as a text file, through the share sheet on native. */
export async function saveRecoveryPhraseFile(phrase: string) {
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
}

/** The 24 words in a selectable box with a copy button. */
export function RecoveryPhraseBox({ phrase }: { phrase: string }) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const handleCopy = async () => {
    await Clipboard.setStringAsync(phrase);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
  };

  return (
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
  );
}

const styles = StyleSheet.create({
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
