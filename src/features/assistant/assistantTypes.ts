/** The open-weights models the user can choose from. */
export type AssistantModelId = 'qwen3-1.7b' | 'qwen3-4b';

export interface AssistantModelOption {
  id: AssistantModelId;
  /** e.g. "Qwen3 1.7B (faster)". */
  label: string;
  /** Size of the download on this platform, in bytes. */
  downloadBytes: number;
}

/** How far loading has got: downloading the files, then preparing the model to run. */
export interface AssistantProgress {
  phase: 'downloading' | 'preparing';
  /** From 0 to 1 within the phase, when known. */
  fraction?: number;
}

/** A loaded model holding one conversation, primed with the health records. */
export interface AssistantSession {
  /** Sends a user message; `onToken` receives the reply as it streams. */
  send(message: string, onToken: (token: string) => void): Promise<string>;
  /** Ends the reply being generated; `send` then resolves with what it has. */
  stop(): void;
  /** Releases the model's memory. */
  dispose(): void;
}

export interface AssistantLoadOptions {
  modelId: AssistantModelId;
  systemPrompt: string;
  onProgress: (progress: AssistantProgress) => void;
  signal: AbortSignal;
}

/** Runs the open-weights model on this device: ExecuTorch on iOS/Android, WebLLM on web. */
export interface AssistantRuntime {
  /** The models offered, the default first. */
  models: AssistantModelOption[];
  /** Whether this device can run the models (web needs WebGPU). */
  isSupported(): Promise<boolean>;
  /** Whether a model is already stored on this device. */
  isDownloaded(modelId: AssistantModelId): Promise<boolean>;
  /** Downloads the model if needed and starts a conversation. */
  load(options: AssistantLoadOptions): Promise<AssistantSession>;
}
