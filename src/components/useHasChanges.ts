import { useState } from 'react';

/** Whether a form's entered values differ from those it started with. */
export function useHasChanges(values: unknown) {
  const [initial] = useState(() => JSON.stringify(values));
  return JSON.stringify(values) !== initial;
}
