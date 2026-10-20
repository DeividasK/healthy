import {
  test,
  takeSnapshot,
  seedTestPatient,
  openRoute,
} from '@/src/features/testing/visualTest';

test('Sync - Enter Recovery Phrase', async ({ page }, testInfo) => {
  await seedTestPatient(page);
  await openRoute(page, '/sync/restore');
  await page.getByTestId('recovery-phrase-input').waitFor();

  await takeSnapshot(page, 'Sync - Enter Recovery Phrase', testInfo);
});
