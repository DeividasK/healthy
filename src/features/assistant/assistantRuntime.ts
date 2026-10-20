import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  createLLMChatSession,
  download,
  models,
  setTelemetryEnabled,
} from 'react-native-executorch';
import { assistantModels } from './assistantModels';
import type { AssistantModelId, AssistantRuntime } from './assistantTypes';

// Each picks the fastest export this platform links: MLX on iOS, XNNPACK on Android.
const MODELS = {
  'qwen3-1.7b': models.llm.QWEN3_1_7B.DEFAULT,
  'qwen3-4b': models.llm.QWEN3_4B.DEFAULT,
};
const downloadedKey = (modelId: AssistantModelId) =>
  `assistant.downloaded:${MODELS[modelId].modelPath}`;

// No download analytics: which models a health app fetches is nobody's business.
setTelemetryEnabled(false);

/** Qwen3 through React Native ExecuTorch. */
export const assistantRuntime: AssistantRuntime = {
  // The .pte export plus the shared 11 MB tokenizer.
  models: assistantModels(
    Platform.OS === 'ios'
      ? { 'qwen3-1.7b': 1_548_250_280, 'qwen3-4b': 2_926_889_768 }
      : { 'qwen3-1.7b': 1_315_169_576, 'qwen3-4b': 2_693_078_056 }
  ),
  isSupported: async () => true,
  // The model cache and this flag are both app data, so they are cleared together.
  isDownloaded: async (modelId) =>
    (await AsyncStorage.getItem(downloadedKey(modelId))) === 'true',
  async load({ modelId, systemPrompt, onProgress, signal }) {
    // A stored model resolves from the cache, with nothing to show.
    const isDownloaded = await assistantRuntime.isDownloaded(modelId);
    const resolved = await download(MODELS[modelId], {
      onProgress: isDownloaded
        ? undefined
        : (fraction) => onProgress({ phase: 'downloading', fraction }),
      signal,
    });
    await AsyncStorage.setItem(downloadedKey(modelId), 'true');
    onProgress({ phase: 'preparing' });
    const session = await createLLMChatSession(resolved, {
      initialMessages: [{ role: 'system', content: systemPrompt }],
      // Qwen3's recommended sampling without thinking.
      generationConfig: { maxNewTokens: 768, temperature: 0.7 },
    });
    if (signal.aborted) {
      session.dispose();
      throw new DOMException('Aborted', 'AbortError');
    }
    return {
      async send(message, onToken) {
        const turn = await session.sendMessage(message, onToken);
        const reply = [...turn.messages]
          .reverse()
          .find((entry) => entry.role === 'assistant');
        return typeof reply?.content === 'string' ? reply.content : '';
      },
      stop: () => session.stop(),
      dispose: () => session.dispose(),
    };
  },
};
