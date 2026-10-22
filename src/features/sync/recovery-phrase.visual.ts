import { expect } from '@playwright/test';
import {
  test,
  takeSnapshot,
  waitForSyncIdle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import {
  connectTestSync,
  FIXED_TEST_SYNC_SECRET_HEX,
} from '@/src/features/testing/mockGoogleDrive';

test('Sync - Recovery Phrase', async ({ page }, testInfo) => {
  await seedTestPatient(page);
  await connectTestSync(page, { secretHex: FIXED_TEST_SYNC_SECRET_HEX });
  await page.goto('/sync/recovery-phrase');
  await expect(page.getByTestId('recovery-phrase-value')).not.toHaveText('');

  await waitForSyncIdle(page);
  await takeSnapshot(page, 'Sync - Recovery Phrase', testInfo);
});
