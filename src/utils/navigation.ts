import type { useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Returns to the previous screen, or to `fallbackHref` when there is no
 * history (e.g. the form was opened directly by URL).
 */
export function goBackOr(router: AppRouter, fallbackHref: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallbackHref as never);
}
