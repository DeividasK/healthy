import { test, takeSnapshot } from '@/src/features/testing/visualTest';
import { seedRangeHistory } from './rangeTestSeed';

for (const [layout, viewport] of [
  ['mobile', undefined],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`Biomarker range form - Edit (${layout})`, async ({
    page,
  }, testInfo) => {
    if (viewport) await page.setViewportSize(viewport);
    await seedRangeHistory(page);
    await page.goto('/biomarker/2823-3');
    await page.getByTestId('biomarker-range-2026-09-02-edit').click();
    await page.getByTestId('biomarker-range-remove-button').waitFor();
    await takeSnapshot(
      page,
      `Biomarker range form - Edit (${layout})`,
      testInfo
    );
  });
  test(`Biomarker range form - Set (${layout})`, async ({ page }, testInfo) => {
    if (viewport) await page.setViewportSize(viewport);
    await seedRangeHistory(page);
    await page.goto('/biomarker/2823-3');
    await page.getByTestId('biomarker-set-range').click();
    await page.getByTestId('biomarker-range-low').waitFor();
    await takeSnapshot(
      page,
      `Biomarker range form - Set (${layout})`,
      testInfo
    );
  });
}
