import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAssistantRuntime } from './assistantEngine';
import { loadChosenModel, saveChosenModel } from './assistantModels';
import type {
  AssistantModelId,
  AssistantProgress,
  AssistantSession,
} from './assistantTypes';
import { buildHealthContext, buildSystemPrompt } from './healthContext';

export type AssistantStatus =
  'checking' | 'unsupported' | 'idle' | 'loading' | 'ready' | 'error';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const PREPARING: AssistantProgress = { phase: 'preparing' };

const LOAD_ERROR =
  "Couldn't load the model. Check your connection and try again.";
const SEND_ERROR =
  "The assistant couldn't answer. Start a new chat and try again.";

/**
 * One conversation with the on-device model about a profile's records. The
 * conversation is kept in memory only and ends when the screen closes.
 * Mount it per profile (keyed by patient ID).
 */
export function useAssistant(patientId: string) {
  const runtime = useMemo(() => getAssistantRuntime(), []);
  const [modelId, setModelId] = useState(runtime.models[0].id);
  const modelIdRef = useRef(modelId);
  const [status, setStatus] = useState<AssistantStatus>('checking');
  const [progress, setProgress] = useState<AssistantProgress>(PREPARING);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const sessionRef = useRef<AssistantSession | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  // The reply in progress: a session is released only once it settles.
  const pendingRef = useRef<Promise<unknown>>(Promise.resolve());
  const nextIdRef = useRef(0);
  const checkRef = useRef(0);

  // Only the latest model check may change the status.
  const cancelChecks = useCallback(() => {
    checkRef.current++;
  }, []);

  const release = useCallback(() => {
    controllerRef.current?.abort();
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    session.stop();
    void pendingRef.current.finally(() => session.dispose());
  }, []);

  const start = useCallback(async () => {
    release();
    cancelChecks();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    setProgress(PREPARING);
    setError(null);
    setMessages([]);
    setIsGenerating(false);
    try {
      const healthContext = await buildHealthContext(patientId);
      const session = await runtime.load({
        modelId: modelIdRef.current,
        systemPrompt: buildSystemPrompt(healthContext, new Date()),
        onProgress: (update) => {
          if (!controller.signal.aborted) setProgress(update);
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        session.dispose();
        return;
      }
      sessionRef.current = session;
      setStatus('ready');
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Failed to load the assistant model:', err);
      setError(LOAD_ERROR);
      setStatus('error');
    }
  }, [patientId, runtime, release, cancelChecks]);

  /** Loads a stored model straight away; a download waits for the user. */
  const prepare = useCallback(
    async (id: AssistantModelId) => {
      const check = ++checkRef.current;
      try {
        const isDownloaded = await runtime.isDownloaded(id);
        if (check !== checkRef.current) return;
        if (isDownloaded) await start();
        else setStatus('idle');
      } catch (err) {
        console.error('Failed to check the assistant model:', err);
        if (check === checkRef.current) setStatus('idle');
      }
    },
    [runtime, start]
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!(await runtime.isSupported())) {
        if (isMounted) setStatus('unsupported');
        return;
      }
      const chosen = await loadChosenModel(runtime.models);
      if (!isMounted) return;
      if (chosen) {
        modelIdRef.current = chosen;
        setModelId(chosen);
      }
      await prepare(modelIdRef.current);
    })().catch((err) => {
      console.error('Failed to check the assistant model:', err);
      if (isMounted) setStatus('idle');
    });
    return () => {
      isMounted = false;
      cancelChecks();
      release();
    };
  }, [runtime, prepare, release, cancelChecks]);

  /** Switches model, ending the conversation with the previous one. */
  const selectModel = useCallback(
    (id: AssistantModelId) => {
      if (id === modelIdRef.current) return;
      modelIdRef.current = id;
      setModelId(id);
      void saveChosenModel(id).catch((err) =>
        console.warn('Failed to remember the assistant model:', err)
      );
      release();
      setStatus('checking');
      setError(null);
      setMessages([]);
      setIsGenerating(false);
      void prepare(id);
    },
    [prepare, release]
  );

  const send = useCallback(async (text: string) => {
    const session = sessionRef.current;
    const message = text.trim();
    if (!session || !message) return;
    const replyId = `message-${++nextIdRef.current}`;
    const setReply = (reply: string) =>
      setMessages((current) =>
        current.map((item) =>
          item.id === replyId ? { ...item, text: reply } : item
        )
      );
    setError(null);
    setIsGenerating(true);
    setMessages((current) => [
      ...current,
      { id: `message-${++nextIdRef.current}`, role: 'user', text: message },
      { id: replyId, role: 'assistant', text: '' },
    ]);
    let streamed = '';
    const pending = session.send(message, (token) => {
      streamed += token;
      setReply(streamed);
    });
    pendingRef.current = pending.catch(() => {});
    try {
      const reply = await pending;
      if (sessionRef.current === session) setReply(reply || streamed);
    } catch (err) {
      if (sessionRef.current !== session) return;
      console.error('The assistant failed to reply:', err);
      setError(SEND_ERROR);
      if (!streamed)
        setMessages((current) => current.filter((item) => item.id !== replyId));
    } finally {
      if (sessionRef.current === session) setIsGenerating(false);
    }
  }, []);

  const stop = useCallback(() => sessionRef.current?.stop(), []);

  return {
    status,
    progress,
    error,
    messages,
    isGenerating,
    models: runtime.models,
    modelId,
    selectModel,
    start,
    send,
    stop,
  };
}
