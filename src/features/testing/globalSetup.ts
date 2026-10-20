import type { FullConfig } from '@playwright/test';

/**
 * Builds the dev server's web bundle once before any worker starts. Metro
 * bundles lazily on the first request, which can take longer than a test's
 * timeout and would otherwise fail whichever test happens to run first.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const html = await (await fetch(baseURL)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
    ([, src]) => new URL(src, baseURL).href
  );
  for (const script of scripts) {
    const response = await fetch(script);
    if (!response.ok)
      throw new Error(`Bundling ${script} failed: ${response.status}`);
    await response.arrayBuffer();
  }
}
