import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Profile Views - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Profile View - Details & Switcher', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await page.goto('/profile');

    await expect(page.getByText('Profile', { exact: true })).toBeVisible();
    await expect(page.getByTestId('active-profile-card')).toBeVisible();

    await takeSnapshot(page, 'Profile View - Details and Switcher', testInfo);
  });

  test('Profile View - Create Form', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await page.goto('/profile/new');

    await expect(page.getByText('New Profile')).toBeVisible();
    await expect(page.getByTestId('patient-given-name-input')).toBeVisible();

    await takeSnapshot(page, 'Profile View - Create Form', testInfo);
  });

  test('Profile View - Connected Google Sync State', async ({
    page,
  }, testInfo) => {
    await clearAppStorage(page);
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-token',
          userEmail: 'alice@gmail.com',
          userName: 'Alice Health',
          userSub: 'sub-123',
          lastSyncTimestamp: '2026-10-02T10:00:00Z',
        })
      );
    });

    await page.goto('/profile');
    await expect(page.getByTestId('google-sync-card')).toBeVisible();
    await expect(page.getByTestId('connected-user-email')).toBeVisible();

    await takeSnapshot(
      page,
      'Profile View - Connected Google Sync State',
      testInfo
    );
  });
});
