import { assistantModels } from './assistantModels';
import type { AssistantModelId, AssistantRuntime } from './assistantTypes';

const MODEL_IDS: Record<AssistantModelId, string> = {
  'qwen3-1.7b': 'Qwen3-1.7B-q4f16_1-MLC',
  'qwen3-4b': 'Qwen3-4B-q4f16_1-MLC',
};

// WebLLM is large, so it loads only when the assistant is used.
const loadWebLlm = () => import('@mlc-ai/web-llm');

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Qwen3 through WebLLM, on the GPU via WebGPU. */
export const assistantRuntime: AssistantRuntime = {
  // Every file in each model's Hugging Face repository.
  models: assistantModels({
    'qwen3-1.7b': 984_156_278,
    'qwen3-4b': 2_279_167_154,
  }),
  async isSupported() {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) return false;
    try {
      return (await gpu.requestAdapter()) !== null;
    } catch {
      return false;
    }
  },
  async isDownloaded(modelId) {
    const { hasModelInCache } = await loadWebLlm();
    return hasModelInCache(MODEL_IDS[modelId]).catch(() => false);
  },
  async load({ modelId, systemPrompt, onProgress, signal }) {
    const { CreateMLCEngine } = await loadWebLlm();
    const engine = await CreateMLCEngine(MODEL_IDS[modelId], {
      // Weights are fetched first ("Fetching param cache…"), then loaded
      // onto the GPU from the cache.
      initProgressCallback: ({ progress, text }) =>
        onProgress({
          phase: text.startsWith('Fetching param cache')
            ? 'downloading'
            : 'preparing',
          fraction: progress,
        }),
    });
    if (signal.aborted) {
      await engine.unload();
      throw new DOMException('Aborted', 'AbortError');
    }
    // The engine is stateless between requests, so the history is resent each turn.
    const history: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
    return {
      async send(message, onToken) {
        history.push({ role: 'user', content: message });
        const chunks = await engine.chat.completions.create({
          messages: history,
          stream: true,
          temperature: 0.7,
          max_tokens: 768,
          extra_body: { enable_thinking: false },
        });
        let reply = '';
        for await (const chunk of chunks) {
          const token = chunk.choices[0]?.delta.content ?? '';
          reply += token;
          if (token) onToken(token);
        }
        history.push({ role: 'assistant', content: reply });
        return reply;
      },
      stop: () => engine.interruptGenerate(),
      dispose: () => void engine.unload(),
    };
  },
};
