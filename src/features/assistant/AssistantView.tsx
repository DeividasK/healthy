import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Download,
  MessageSquarePlus,
  RefreshCw,
  SendHorizontal,
  Square,
} from 'lucide-react-native';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { FormField, FormTextInput } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import {
  getActionDockMenuOffset,
  ResourceActionDock,
  type DockAction,
} from '@/src/components/ResourceActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { formatBytes, stripThinking } from './assistantText';
import type { AssistantModelId, AssistantProgress } from './assistantTypes';
import { useAssistant, type AssistantMessage } from './useAssistant';

/** Chat with an on-device AI model about the active profile's records. */
export function AssistantView() {
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading || !activePatientId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }
  // A new profile starts a new conversation with its own records.
  return <AssistantChat key={activePatientId} patientId={activePatientId} />;
}

function AssistantChat({ patientId }: { patientId: string }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const {
    status,
    progress,
    error,
    messages,
    isGenerating,
    models,
    modelId,
    selectModel,
    start,
    send,
    stop,
  } = useAssistant(patientId);
  const model = models.find((option) => option.id === modelId) ?? models[0];
  // Keeps "1.3 GB" on one line.
  const sizeText = (bytes: number) => formatBytes(bytes).replace(' ', '\u00a0');
  const downloadSize = sizeText(model.downloadBytes);
  const canChooseModel = status !== 'checking' && status !== 'unsupported';

  const handleSend = () => {
    if (!draft.trim() || isGenerating) return;
    void send(draft);
    setDraft('');
  };

  const actions = useMemo((): DockAction[] => {
    switch (status) {
      case 'idle':
        return [
          {
            label: `Download model (${downloadSize})`,
            testID: 'assistant-download-button',
            icon: Download,
            onPress: () => void start(),
            primary: true,
          },
        ];
      case 'error':
        return [
          {
            label: 'Try again',
            testID: 'assistant-retry-button',
            icon: RefreshCw,
            onPress: () => void start(),
            primary: true,
          },
        ];
      case 'ready':
        return [
          isGenerating
            ? {
                label: 'Stop',
                testID: 'assistant-stop-button',
                icon: Square,
                onPress: stop,
                primary: true,
              }
            : {
                label: 'Send',
                testID: 'assistant-send-button',
                icon: SendHorizontal,
                onPress: handleSend,
                primary: true,
                disabled: !draft.trim(),
              },
          ...(messages.length > 0
            ? [
                {
                  label: 'New chat',
                  testID: 'assistant-new-chat-button',
                  icon: MessageSquarePlus,
                  onPress: () => void start(),
                  disabled: isGenerating,
                },
              ]
            : []),
        ];
      default:
        return [];
    }
    // handleSend reads the current draft, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isGenerating, draft, messages.length, downloadSize, start, stop]);

  const dockOffset = getActionDockMenuOffset(insets.bottom);

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={[
          styles.scrollContent,
          status !== 'ready' && { paddingBottom: dockOffset },
        ]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
        testID="assistant-view"
      >
        <ScreenHeading testID="assistant-title">Assistant</ScreenHeading>
        {error && <FormErrorBanner message={error} testID="assistant-error" />}
        {canChooseModel && (
          <FormField label="Model" nativeID="assistant-model" required>
            <NativeSelect
              testID="assistant-model"
              name="model"
              label="Model"
              value={modelId}
              options={models.map((option) => ({
                id: option.id,
                label: `${option.label} · ${formatBytes(option.downloadBytes)}`,
              }))}
              onChange={(id) => selectModel(id as AssistantModelId)}
              disabled={status === 'loading' || isGenerating}
            />
          </FormField>
        )}
        {status === 'checking' && (
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        )}
        {status === 'unsupported' && (
          <Text style={styles.body} testID="assistant-unsupported">
            This browser can&apos;t run the assistant: it needs WebGPU. Try a
            recent version of Chrome, Edge or Safari, or the Healthy app on your
            phone.
          </Text>
        )}
        {(status === 'idle' || status === 'loading') && (
          <View style={styles.intro}>
            <Text style={styles.body} testID="assistant-intro">
              Ask questions about your health records. The assistant is an AI
              model that runs on this device, so your records never leave it. It
              needs a one-time download of about {downloadSize}.
            </Text>
            <Text style={styles.caution}>
              Answers can be wrong. The assistant isn&apos;t a doctor.
            </Text>
          </View>
        )}
        {status === 'loading' && (
          <LoadingProgress
            progress={progress}
            downloadBytes={model.downloadBytes}
            sizeText={sizeText}
          />
        )}
        {status === 'ready' && messages.length === 0 && (
          <Text style={styles.caution} testID="assistant-empty">
            Ask about your conditions, treatments, consultations or lab results.
            Answers can be wrong. The assistant isn&apos;t a doctor.
          </Text>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </ScrollView>
      {status === 'ready' && (
        <View style={[styles.composer, { paddingBottom: dockOffset }]}>
          <FormTextInput
            id="assistant-message"
            nativeID="assistant-message"
            name="message"
            testID="assistant-message-input"
            accessibilityLabel="Message"
            placeholder="Ask about your records"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            submitBehavior="submit"
            returnKeyType="send"
          />
        </View>
      )}
      <ResourceActionDock actions={actions} />
    </View>
  );
}

/** A bar with the amount downloaded, then preparing the model to run. */
function LoadingProgress({
  progress: { phase, fraction },
  downloadBytes,
  sizeText,
}: {
  progress: AssistantProgress;
  downloadBytes: number;
  sizeText: (bytes: number) => string;
}) {
  const isDownloading = phase === 'downloading';
  const percent =
    fraction === undefined ? undefined : Math.round(fraction * 100);
  const title = isDownloading
    ? 'Downloading the model'
    : 'Preparing the model…';
  return (
    <View style={styles.progress} testID="assistant-loading">
      <View style={styles.progressHeading}>
        {percent === undefined && (
          <ActivityIndicator color={COLORS.light.primary} />
        )}
        <Text style={styles.body}>{title}</Text>
      </View>
      {percent !== undefined && (
        <>
          <View
            style={styles.progressTrack}
            role="progressbar"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.caution} testID="assistant-progress-text">
            {isDownloading
              ? `${sizeText((fraction ?? 0) * downloadBytes)} of ${sizeText(downloadBytes)} · ${percent}%`
              : `${percent}%`}
          </Text>
        </>
      )}
    </View>
  );
}

function ChatMessage({ message }: { message: AssistantMessage }) {
  const isUser = message.role === 'user';
  const text = isUser ? message.text : stripThinking(message.text);
  return (
    <View
      style={[styles.message, isUser ? styles.userMessage : null]}
      testID={`assistant-message-${message.role}`}
    >
      {text ? (
        <Text style={styles.messageText} selectable>
          {text}
        </Text>
      ) : (
        <ActivityIndicator
          color={COLORS.light.primary}
          accessibilityLabel="Writing a reply"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  intro: {
    gap: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.light.foreground,
  },
  caution: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.textSecondary,
  },
  progress: {
    marginTop: 24,
    gap: 8,
  },
  progressHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: COLORS.light.pillBackground,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.light.primary,
  },
  message: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.light.pillBackground,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.light.foreground,
  },
  composer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
    backgroundColor: COLORS.light.background,
  },
});
