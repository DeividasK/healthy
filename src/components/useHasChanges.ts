import { useState } from 'react';

/**
 * Whether a form's entered values differ from those it started with. Pass
 * `ready = false` while stored values are still loading; the baseline is
 * taken from the first render once ready.
 */
export function useHasChanges(values: unknown, ready = true) {
  const current = JSON.stringify(values);
  const [initial, setInitial] = useState<string | null>(ready ? current : null);
  if (ready && initial === null) setInitial(current);
  return ready && initial !== null && current !== initial;
}
