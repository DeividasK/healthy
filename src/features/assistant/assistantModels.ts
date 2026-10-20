import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AssistantModelId, AssistantModelOption } from './assistantTypes';

const MODEL_KEY = 'assistant.model';

/** Qwen3 in two sizes; both runtimes export the same models. */
export function assistantModels(
  downloadBytes: Record<AssistantModelId, number>
): AssistantModelOption[] {
  return [
    {
      id: 'qwen3-1.7b',
      label: 'Qwen3 1.7B (faster)',
      downloadBytes: downloadBytes['qwen3-1.7b'],
    },
    {
      id: 'qwen3-4b',
      label: 'Qwen3 4B (better answers)',
      downloadBytes: downloadBytes['qwen3-4b'],
    },
  ];
}

/** The model this device last chose, if it is still offered. */
export async function loadChosenModel(
  options: AssistantModelOption[]
): Promise<AssistantModelId | null> {
  const stored = await AsyncStorage.getItem(MODEL_KEY).catch(() => null);
  return options.find((option) => option.id === stored)?.id ?? null;
}

export async function saveChosenModel(id: AssistantModelId): Promise<void> {
  await AsyncStorage.setItem(MODEL_KEY, id);
}
