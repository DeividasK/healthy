import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  BotMessageSquare,
  Calendar,
  MessageSquareText,
} from 'lucide-react-native';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import { FilterGroup, FilterGroups } from '@/src/components/FilterControls';
import { NativeSelect } from '@/src/components/NativeSelect';
import { saveFile } from '@/src/services/fileExport';
import { COLORS } from '@/src/theme/colors';
import {
  SHARE_PERIODS,
  SHARE_QUESTIONS,
  estimateTokens,
  type SharePeriodId,
  type ShareQuestionId,
} from './shareText';

const COPIED_FEEDBACK_MS = 2000;

/** Preview switch for the layout options: a, b or c. */
export function getShareVariant(): 'a' | 'b' | 'c' {
  try {
    const value =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('healthy-share-variant')
        : null;
    return value === 'b' || value === 'c' ? value : 'a';
  } catch {
    return 'a';
  }
}

/** Copies, shares or downloads text for the user's own AI. */
export function useShareActions(text: string, fileName: string) {
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
    if (Platform.OS === 'web') {
      await saveFile(new TextEncoder().encode(text), fileName, {
        mimeType: 'text/markdown',
        dialogTitle: 'Share with AI',
      });
      return;
    }
    await Share.share({ message: text });
  };
  return {
    copied,
    copy,
    share,
    shareLabel: Platform.OS === 'web' ? 'Download' : 'Share',
  };
}

/** The text exactly as it will be copied, in a scrolling box. */
export function SharePreview({
  text,
  maxHeight = 260,
}: {
  text: string;
  maxHeight?: number;
}) {
  return (
    <View>
      <ScrollView
        style={[styles.preview, { maxHeight }]}
        testID="share-ai-preview"
      >
        <Text style={styles.previewText} selectable>
          {text}
        </Text>
      </ScrollView>
      <Text style={styles.size}>
        About {estimateTokens(text).toLocaleString()} tokens
      </Text>
    </View>
  );
}

/**
 * Shows what will be shared with the user's AI and copies it. With
 * `withOptions`, the user also picks the dates and the question.
 */
export function ShareWithAIModal({
  build,
  fileName,
  withOptions,
  onClose,
}: {
  build: (options: {
    period: SharePeriodId;
    question: ShareQuestionId;
  }) => string;
  fileName: string;
  withOptions?: boolean;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<SharePeriodId>('all');
  const [question, setQuestion] = useState<ShareQuestionId>('explain');
  const text = useMemo(
    () => build({ period, question }),
    [build, period, question]
  );
  const { copied, copy, share, shareLabel } = useShareActions(text, fileName);

  return (
    <CenteredModal
      visible
      title="Share with AI"
      icon={BotMessageSquare}
      onClose={onClose}
      testID="share-ai-modal"
    >
      <Text style={styles.description}>
        Paste this into Claude, ChatGPT or any AI. Your name isn&apos;t
        included.
      </Text>
      {withOptions && (
        <View style={styles.options}>
          <FilterGroups>
            <FilterGroup icon={Calendar} label="Dates">
              <NativeSelect
                compact
                label="Dates"
                name="share-ai-period"
                testID="share-ai-period"
                value={period}
                options={SHARE_PERIODS.map(({ id, label }) => ({ id, label }))}
                onChange={(value) => setPeriod(value as SharePeriodId)}
              />
            </FilterGroup>
            <FilterGroup icon={MessageSquareText} label="Ask">
              <NativeSelect
                compact
                label="Ask"
                name="share-ai-question"
                testID="share-ai-question"
                value={question}
                options={SHARE_QUESTIONS.map(({ id, label }) => ({
                  id,
                  label,
                }))}
                onChange={(value) => setQuestion(value as ShareQuestionId)}
              />
            </FilterGroup>
          </FilterGroups>
        </View>
      )}
      <SharePreview text={text} maxHeight={withOptions ? 200 : 280} />
      <ModalActions>
        <ModalButton
          label={shareLabel}
          testID="share-ai-share-button"
          onPress={share}
        />
        <ModalButton
          label={copied ? 'Copied' : 'Copy'}
          tone="primary"
          testID="share-ai-copy-button"
          onPress={copy}
        />
      </ModalActions>
    </CenteredModal>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.mutedForeground,
    marginBottom: 12,
  },
  options: {
    marginBottom: 12,
  },
  preview: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 12,
    backgroundColor: COLORS.light.card,
    padding: 12,
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
    marginBottom: 4,
  },
});
