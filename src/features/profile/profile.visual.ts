import {
  test,
  takeSnapshot,
  waitForSyncIdle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import { connectTestSync } from '@/src/features/testing/mockGoogleDrive';

test.describe('Profile Views - Visual Regression', () => {
  test('Profile View - Details & Switcher', async ({ page }, testInfo) => {
    await seedTestPatient(page, { id: 'patient-visual' });
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
    await seedTestPatient(page, { id: 'patient-visual' });
    await connectTestSync(page, { userEmail: 'alice@gmail.com' });
    await page.goto('/profile');
    await page.getByTestId('up-to-date-button').waitFor();
    await waitForSyncIdle(page);

    await takeSnapshot(
      page,
      'Profile View - Connected Google Sync State',
      testInfo
    );
  });
});
