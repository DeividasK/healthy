import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Sparkles } from 'lucide-react-native';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import { FieldRevealProvider } from '@/src/components/FieldReveal';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { FormField } from '@/src/components/FormField';
import { COLORS } from '@/src/theme/colors';
import {
  buildLabResultsAIInstructions,
  parseLabResultsAIReply,
  type ImportedLabResults,
} from './labResultsAIImport';

const COPIED_FEEDBACK_MS = 2000;

/**
 * Lets the user copy instructions for their own AI assistant, then paste its
 * reply to fill in the lab results form. Mount it while open, so each opening
 * starts empty.
 */
export function ImportLabResultsModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (data: ImportedLabResults) => void;
}) {
  const [reply, setReply] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildLabResultsAIInstructions());
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
  };

  const handleImport = () => {
    const result = parseLabResultsAIReply(reply);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onImport(result.data);
  };

  return (
    <CenteredModal
      visible
      title="Import with AI"
      icon={Sparkles}
      onClose={onClose}
      testID="ai-import-modal"
    >
      {/* Fields here are not added from the form's + menu, so none is revealed. */}
      <FieldRevealProvider value={null}>
        <Text style={styles.description}>
          Copy the instructions and send them to your AI assistant together with
          your lab report. Then paste its reply below to fill in the form.
        </Text>
        <View style={styles.copy}>
          <ModalButton
            label={copied ? 'Instructions copied' : 'Copy instructions'}
            testID="ai-import-copy-button"
            onPress={handleCopy}
          />
        </View>
        {errors.length > 0 && (
          <FormErrorBanner
            testID="ai-import-errors"
            message={errors.join('\n')}
          />
        )}
        <FormField
          label="AI reply"
          nativeID="ai-import-reply"
          required
          inputProps={{
            testID: 'ai-import-reply-input',
            id: 'ai-import-reply',
            nativeID: 'ai-import-reply',
            name: 'aiReply',
            placeholder: "Paste the AI's reply here",
            multiline: true,
            numberOfLines: 6,
            autoCapitalize: 'none',
            autoCorrect: false,
            value: reply,
            onChangeText: setReply,
            style: styles.reply,
          }}
        />
        <ModalActions>
          <ModalButton
            label="Cancel"
            testID="ai-import-cancel-button"
            onPress={onClose}
          />
          <ModalButton
            label="Import"
            tone="primary"
            testID="ai-import-submit-button"
            disabled={!reply.trim()}
            onPress={handleImport}
          />
        </ModalActions>
      </FieldRevealProvider>
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
  copy: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  reply: {
    maxHeight: 200,
    fontSize: 14,
  },
});
