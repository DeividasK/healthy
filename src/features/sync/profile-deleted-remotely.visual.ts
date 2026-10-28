import {
  test,
  takeSnapshot,
  waitForSyncIdle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import {
  connectTestSync,
  evaluateBridge,
} from '@/src/features/testing/testStorage';

test('Sync - Profile Deleted From Google Drive', async ({ page }, testInfo) => {
  await seedTestPatient(page, { id: 'patient-visual', givenName: 'Alice' });
  await connectTestSync(page);
  // As if another device had deleted the profile from Google Drive.
  await evaluateBridge(page, (b) =>
    b.executeSql(
      `UPDATE sync_profiles SET deletion_hold_hlc = '0000000000000:0000:remote'
       WHERE patient_id = 'patient-visual'`
    )
  );
  await page.goto('/profile');
  await page.getByTestId('profile-deleted-remotely-modal-card').waitFor();
  // The sync that runs on load has finished and its 1 s checkmark is gone.
  await waitForSyncIdle(page);
  await page
    .getByTestId('backup-status-text')
    .filter({ hasText: 'up to date' })
    .waitFor();

  await takeSnapshot(
    page,
    'Sync - Profile Deleted From Google Drive',
    testInfo
  );
});
