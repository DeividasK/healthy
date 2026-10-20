import { type Page } from '@playwright/test';

export interface AssistantMockOptions {
  /** Whether the browser can run the model. */
  supported?: boolean;
  /** Models already stored on the device. */
  downloaded?: ('qwen3-1.7b' | 'qwen3-4b')[];
  /** Keeps the model loading at 42%, for the loading state. */
  holdLoad?: boolean;
}

/**
 * Replaces the on-device model with a scripted one (see `getAssistantRuntime`).
 * Headless browsers have no WebGPU, and a real model would take minutes.
 * Replies echo the question; the model loaded and the instructions it
 * received are kept in `window.__assistantModel` and
 * `window.__assistantSystemPrompt`.
 */
export async function mockAssistant(
  page: Page,
  options: AssistantMockOptions = {}
): Promise<void> {
  await page.addInitScript(
    ({ supported = true, downloaded = [], holdLoad = false }) => {
      const testWindow = window as any;
      testWindow.__HEALTHY_TEST_ASSISTANT__ = {
        models: [
          {
            id: 'qwen3-1.7b',
            label: 'Qwen3 1.7B (faster)',
            downloadSize: '1 GB',
          },
          {
            id: 'qwen3-4b',
            label: 'Qwen3 4B (better answers)',
            downloadSize: '2.3 GB',
          },
        ],
        isSupported: async () => supported,
        isDownloaded: async (modelId: string) =>
          (downloaded as string[]).includes(modelId),
        load: async ({
          modelId,
          systemPrompt,
          onProgress,
        }: {
          modelId: string;
          systemPrompt: string;
          onProgress: (fraction: number) => void;
        }) => {
          testWindow.__assistantModel = modelId;
          testWindow.__assistantSystemPrompt = systemPrompt;
          onProgress(0.42);
          if (holdLoad) await new Promise(() => {});
          onProgress(1);
          return {
            send: async (message: string, onToken: (token: string) => void) => {
              // Qwen3 can open with an empty reasoning block, which is hidden.
              const reply = `<think>\n\n</think>\n\nYou asked: ${message}`;
              for (const token of reply.match(/\S+\s*|\s+/g) ?? [])
                onToken(token);
              return reply;
            },
            stop() {},
            dispose() {},
          };
        },
      };
    },
    options
  );
}
