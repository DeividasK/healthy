import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, Sparkles } from 'lucide-react-native';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import { FieldRevealProvider } from '@/src/components/FieldReveal';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { FormField, FormTextInput } from '@/src/components/FormField';
import { COLORS } from '@/src/theme/colors';
import type { AIImportResult } from '@/src/utils/aiImport';

const COPIED_FEEDBACK_MS = 2000;

/**
 * Lets the user copy instructions for their own AI assistant, then paste its
 * reply to fill in a form. Mount it while open, so each opening starts empty.
 */
export function AIImportModal<T>({
  document,
  instructions,
  parse,
  onClose,
  onImport,
}: {
  /** What the user shares with the AI, e.g. "lab report". */
  document: string;
  /** Builds the instructions copied for the AI. */
  instructions: () => string;
  /** Reads the AI's reply, or lists its problems. */
  parse: (reply: string) => AIImportResult<T> | Promise<AIImportResult<T>>;
  onClose: () => void;
  onImport: (data: T) => void;
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
    await Clipboard.setStringAsync(instructions());
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setReply(text);
  };

  const handleImport = async () => {
    const result = await parse(reply);
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
          your {document}. Then paste its reply below to fill in the form.
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
        <FormField label="AI reply" nativeID="ai-import-reply" required>
          <View>
            <FormTextInput
              testID="ai-import-reply-input"
              id="ai-import-reply"
              nativeID="ai-import-reply"
              name="aiReply"
              placeholder="Paste the AI's reply here"
              multiline
              numberOfLines={6}
              autoCapitalize="none"
              autoCorrect={false}
              value={reply}
              onChangeText={setReply}
              style={styles.reply}
            />
            <TouchableOpacity
              testID="ai-import-paste-button"
              style={styles.pasteButton}
              onPress={handlePaste}
              accessibilityRole="button"
              accessibilityLabel="Paste AI reply"
              activeOpacity={0.7}
            >
              <ClipboardPaste size={18} color={COLORS.light.foreground} />
            </TouchableOpacity>
          </View>
        </FormField>
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
    // Leaves room for the paste button in the top-right corner.
    paddingRight: 52,
  },
  pasteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.pillBackground,
  },
});
