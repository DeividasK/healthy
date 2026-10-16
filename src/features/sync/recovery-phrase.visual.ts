import { expect } from '@playwright/test';
import {
  test,
  takeSnapshot,
  waitForSyncIdle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import { connectTestSync } from '@/src/features/testing/mockGoogleDrive';

test('Sync - Recovery Phrase', async ({ page }, testInfo) => {
  await seedTestPatient(page);
  // A fixed secret keeps the 24 words identical between runs.
  await connectTestSync(page, {
    secretHex: Array.from({ length: 32 }, (_, i) =>
      (i * 7).toString(16).padStart(2, '0')
    ).join(''),
  });
  await page.goto('/sync/recovery-phrase');
  await expect(page.getByTestId('recovery-phrase-value')).not.toHaveText('');

  await waitForSyncIdle(page);
  await takeSnapshot(page, 'Sync - Recovery Phrase', testInfo);
});
