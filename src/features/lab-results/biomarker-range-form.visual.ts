import { test, takeSnapshot } from '@/src/features/testing/visualTest';
import { seedRangeHistory } from './rangeTestSeed';

// Edit shows the whole form: filled limits and optimal part, and a dock with
// Remove range. The Set form (empty fields, no Remove range) is checked in
// biomarker-detail.e2e.ts, and the form has no desktop-only layout.
test('Biomarker range form - Edit (mobile)', async ({ page }, testInfo) => {
  await seedRangeHistory(page);
  await page.goto('/biomarker/2823-3');
  await page.getByTestId('biomarker-range-2026-09-02-edit').click();
  await page.getByTestId('biomarker-range-remove-button').waitFor();
  await takeSnapshot(page, 'Biomarker range form - Edit (mobile)', testInfo);
});
