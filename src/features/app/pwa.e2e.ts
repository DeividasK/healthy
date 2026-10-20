import {
  test,
  expect,
  createPatientViaUI,
} from '@/src/features/testing/testStorage';

// Loading the app is what these tests are about.
test.use({ freshApp: true });

test.describe('Installable web app', () => {
  test('links a manifest with home-screen icons', async ({ page, request }) => {
    await createPatientViaUI(page);

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
  }) => {
    await createPatientViaUI(page);
    await expect(page.getByTestId('offline-header-indicator')).toHaveCount(0);

    await context.setOffline(true);
    const indicator = page.getByTestId('offline-header-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveAccessibleName('Offline');
    await expect(page.getByTestId('sync-header-indicator')).toHaveCount(0);

    await context.setOffline(false);
    await expect(indicator).toHaveCount(0);
  });
});
