import { Platform } from 'react-native';
import { assistantRuntime } from './assistantRuntime';
import type { AssistantRuntime } from './assistantTypes';

/**
 * The model runtime for this platform. Web tests substitute a scripted
 * runtime (`mockAssistant`), since headless browsers cannot run the model.
 */
export function getAssistantRuntime(): AssistantRuntime {
  if (
    Platform.OS === 'web' &&
    process.env.NODE_ENV !== 'production' &&
    typeof window !== 'undefined'
  ) {
    const testRuntime = (
      window as Window & { __HEALTHY_TEST_ASSISTANT__?: AssistantRuntime }
    ).__HEALTHY_TEST_ASSISTANT__;
    if (testRuntime) return testRuntime;
  }
  return assistantRuntime;
}
