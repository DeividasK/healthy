import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  COPY_CORNER_INSET,
  CopyCornerButton,
} from '@/src/components/CopyCornerButton';
import { COLORS } from '@/src/theme/colors';
import { estimateTokens } from './shareText';

const COPIED_FEEDBACK_MS = 2000;

/** Whether this browser has a share sheet (phones, Safari, Edge). */
const canShareOnWeb = () =>
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.share === 'function';

/**
 * Shares text through the system share sheet, like other apps, or copies
 * it where there is no share sheet.
 */
export function useShareActions(text: string, title: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const copy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };
  const share = async () => {
    if (Platform.OS !== 'web') {
      await Share.share({ message: text, title });
      return;
    }
    if (canShareOnWeb()) {
      try {
        await navigator.share({ text, title });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    await copy();
  };
  return { copied, copy, share };
}

/** The text exactly as it will be shared, in a scrolling box. */
export function SharePreview({
  text,
  maxHeight = 260,
}: {
  text: string;
  maxHeight?: number;
}) {
  return (
    <View>
      <View>
        <ScrollView
          style={[styles.preview, { maxHeight }]}
          testID="share-ai-preview"
        >
          <Text style={styles.previewText} selectable>
            {text}
          </Text>
        </ScrollView>
        <CopyCornerButton
          text={text}
          label="shared text"
          testID="share-ai-preview-copy-button"
        />
      </View>
      <Text style={styles.size}>
        About {estimateTokens(text).toLocaleString()} tokens
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 12,
    backgroundColor: COLORS.light.card,
    padding: 12,
    paddingRight: COPY_CORNER_INSET,
  },
  previewText: {
    fontFamily: Platform.select({
      web: 'ui-monospace, Menlo, monospace',
      default: 'monospace',
    }),
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.light.foreground,
  },
  size: {
    fontSize: 12,
    color: COLORS.light.mutedForeground,
    marginTop: 6,
  },
});
