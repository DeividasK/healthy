import type { Route } from '@playwright/test';
import {
  test,
  expect,
  seedTestPatient,
  bootstrapApp,
  restartApp,
} from '@/src/features/testing/testStorage';
import { connectTestSync } from '@/src/features/testing/mockGoogleDrive';

test.describe('Installable web app', () => {
  test('links a manifest with home-screen icons', async ({ page, request }) => {
    // The app links the manifest when it starts, on any screen, with or
    // without a profile.
    await bootstrapApp(page);

    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(href).toBeTruthy();
    const manifestUrl = new URL(href!, page.url());
    const manifest = await (await request.get(manifestUrl.href)).json();
    expect(manifest).toMatchObject({
      name: 'Healthy',
      display: 'standalone',
      start_url: './',
    });

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons) {
      const response = await request.get(new URL(icon.src, manifestUrl).href);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('shows the offline status in place of the sync indicator', async ({
    page,
    context,
    consoleMonitor,
  }) => {
    await seedTestPatient(page);
    await expect(page.getByTestId('offline-header-indicator')).toHaveCount(0);

    await context.setOffline(true);
    const indicator = page.getByTestId('offline-header-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveAccessibleName('Offline');
    await expect(page.getByTestId('sync-header-indicator')).toHaveCount(0);

    await context.setOffline(false);
    await expect(indicator).toHaveCount(0);

    await test.step('while connected but Google cannot be reached', async () => {
      await connectTestSync(page);
      const google = 'https://www.googleapis.com/**';
      const failLookup = (route: Route) => route.abort('namenotresolved');
      await page.route(google, failLookup);
      // The browser logs each request that cannot reach Google.
      consoleMonitor.ignore('net::ERR_NAME_NOT_RESOLVED');
      // Remount so sync starts with the connection made through the bridge.
      await restartApp(page, '/profile');
      await expect(indicator).toBeVisible();
      await expect(page.getByTestId('sync-header-indicator')).toHaveCount(0);

      // The app checks again on its own and clears the status once through.
      await page.unroute(google, failLookup);
      await page.clock.fastForward(10_000);
      await expect(indicator).toHaveCount(0);
    });
  });
});
