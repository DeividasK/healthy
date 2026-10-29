import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { strToU8 } from 'fflate';
import {
  COPY_CORNER_INSET,
  CopyCornerButton,
} from '@/src/components/CopyCornerButton';
import { saveFile } from '@/src/services/fileExport';
import { COLORS } from '@/src/theme/colors';

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
      <CopyCornerButton
        text={phrase}
        label="recovery phrase"
        testID="recovery-phrase-copy-button"
      />
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
    paddingRight: COPY_CORNER_INSET,
  },
  phrase: {
    fontSize: 16,
    lineHeight: 28,
    color: COLORS.light.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
