import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { createPatientViaUI } from '@/src/features/testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Profile Views - Visual Regression', () => {
  test('Profile View - Details & Switcher', async ({ page }, testInfo) => {
    await createPatientViaUI(page);
    await page.getByTestId('profile-header-button').click();

    await expect(page.getByText('Profile', { exact: true })).toBeVisible();
    await expect(page.getByTestId('active-profile-card')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(page, 'Profile View - Details and Switcher', testInfo);
  });

  test('Profile View - Add Profile Options', async ({ page }, testInfo) => {
    await page.goto('/profile/new');

    await expect(page.getByText('Add Profile')).toBeVisible();
    await expect(page.getByTestId('option-create-profile')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(page, 'Profile View - Add Profile Options', testInfo);
  });

  test('Profile View - Connected Google Sync State', async ({
    page,
  }, testInfo) => {
    await createPatientViaUI(page);
    await page.route('https://www.googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [], id: 'file-123' }),
      });
    });

    await page.getByTestId('profile-header-button').click();
    await expect(page.getByTestId('google-sync-card')).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-google-access-token',
          userEmail: 'alice@gmail.com',
          userName: 'Alice Health',
          userSub: 'google-sub-12345',
          lastSyncTimestamp: '2026-10-02T10:00:00Z',
        })
      );
    });

    await page.reload();

    const connectBtn = page.getByTestId('google-signin-button');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();
    await expect(page.getByTestId('google-sync-card')).toBeVisible();
    await expect(page.getByTestId('connected-user-email')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(
      page,
      'Profile View - Connected Google Sync State',
      testInfo
    );
  });

  test('Profile View - Restore From File Option', async ({
    page,
  }, testInfo) => {
    await page.goto('/profile/restore-from-file');

    await expect(page.getByText('Add Profile')).toBeVisible();
    await expect(page.getByTestId('option-restore-file')).toBeVisible();
    await expect(page.getByTestId('select-profile-file-button')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(
      page,
      'Profile View - Restore From File Option',
      testInfo
    );
  });

  test('Profile View - Restore From Google Drive Option', async ({
    page,
  }, testInfo) => {
    await page.goto('/profile/restore-from-google-drive');

    await expect(page.getByText('Add Profile')).toBeVisible();
    await expect(page.getByTestId('option-restore-gdrive')).toBeVisible();
    await expect(page.getByTestId('connect-google-drive-button')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(
      page,
      'Profile View - Restore From Google Drive Option',
      testInfo
    );
  });
});
