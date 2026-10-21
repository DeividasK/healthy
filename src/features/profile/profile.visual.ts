import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  waitForSyncIdle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import { TEST_PHOTO_PNG } from '@/src/features/testing/testRecords';
import { connectTestSync } from '@/src/features/testing/mockGoogleDrive';

test.describe('Profile Views - Visual Regression', () => {
  test('Profile View - Details & Switcher', async ({ page }, testInfo) => {
    await seedTestPatient(page, {
      id: 'patient-visual',
      photo: { contentType: 'image/png', data: TEST_PHOTO_PNG },
    });
    await page.goto('/profile');
    await page.getByTestId('profile-avatar-photo').waitFor();

    await takeSnapshot(page, 'Profile View - Details', testInfo);

    await page.getByTestId('switch-profile-button').click();
    await page.getByTestId('profile-switcher').waitFor();
    await takeSnapshot(page, 'Profile View - Switcher Open', testInfo);
  });

  test('Profile View - Add a profile', async ({ page }, testInfo) => {
    await seedTestPatient(page, { id: 'patient-visual' });
    await page.goto('/profile/new');
    await page.getByTestId('add-profile-header-title').waitFor();
    await takeSnapshot(page, 'Profile View - Add a profile', testInfo);

    for (const option of [
      'menu-add-family-name',
      'menu-add-birth-date',
      'menu-add-gender',
      'menu-add-photo',
    ]) {
      await page.getByTestId('add-option-button').click();
      await waitForMenuToggle(page, 'add-option-button', true);
      await page.getByTestId(option).click();
      await waitForMenuToggle(page, 'add-option-button', false);
    }
    await page.getByTestId('upload-photo-button').waitFor();
    await takeSnapshot(
      page,
      'Profile View - Add a profile with optional fields',
      testInfo
    );
  });

  test('Profile View - Restore a profile', async ({ page }, testInfo) => {
    await seedTestPatient(page, { id: 'patient-visual' });
    await page.goto('/profile/restore');
    await page.getByTestId('restore-from-file').waitFor();
    await takeSnapshot(page, 'Profile View - Restore a profile', testInfo);
  });

  test('Profile View - Connected Google Sync State', async ({
    page,
  }, testInfo) => {
    await seedTestPatient(page, { id: 'patient-visual' });
    await connectTestSync(page, { userEmail: 'alice@gmail.com' });
    await page.goto('/profile');
    await page
      .getByTestId('backup-status-text')
      .filter({ hasText: 'up to date' })
      .waitFor();
    await waitForSyncIdle(page);

    await takeSnapshot(
      page,
      'Profile View - Connected Google Sync State',
      testInfo
    );

    await page.getByTestId('show-recovery-phrase-button').click();
    await page
      .getByTestId('recovery-phrase-value')
      .filter({ hasText: /^(\S+ ){23}\S+$/ })
      .waitFor();
    await takeSnapshot(page, 'Profile View - Recovery Phrase Modal', testInfo);
  });
});
