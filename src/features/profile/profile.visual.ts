import {
  test,
  takeSnapshot,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import { mockGoogleDriveRoutes } from '@/src/features/testing/mockGoogleDrive';

test.describe('Profile Views - Visual Regression', () => {
  test('Profile View - Details & Switcher', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await page.goto('/profile');
    await page.getByTestId('active-profile-card').waitFor();

    await takeSnapshot(page, 'Profile View - Details and Switcher', testInfo);
  });

  test('Profile View - Add Profile Options', async ({ page }, testInfo) => {
    await page.goto('/profile/new');
    await page.getByTestId('option-create-profile').waitFor();

    await takeSnapshot(page, 'Profile View - Add Profile Options', testInfo);
    await page.getByTestId('option-restore-file').click();
    await page.getByText('Restore From Backup', { exact: true }).waitFor();

    await takeSnapshot(
      page,
      'Profile View - Restore From File Option',
      testInfo
    );

    await page.getByTestId('option-restore-gdrive').click();
    await page.getByText('Google Drive Sync', { exact: true }).waitFor();

    await takeSnapshot(
      page,
      'Profile View - Restore From Google Drive Option',
      testInfo
    );
  });

  test('Profile View - Connected Google Sync State', async ({
    page,
  }, testInfo) => {
    await mockGoogleDriveRoutes(page);
    await page.addInitScript(() => {
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
    await seedTestPatient(page, { syncAccount: 'google-sub-12345' });
    await page.goto('/profile');
    await page.getByTestId('connected-user-email').waitFor();

    await takeSnapshot(
      page,
      'Profile View - Connected Google Sync State',
      testInfo
    );
  });
});
