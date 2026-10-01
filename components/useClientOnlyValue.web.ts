import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

// `useSyncExternalStore` determines if we're on the server or client
// without causing cascading renders.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return useSyncExternalStore(
    emptySubscribe,
    () => client,
    () => server
  );
}
