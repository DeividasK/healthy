import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/visualTest';
import { expect } from '@playwright/test';

test('Biomarker detail - Mixed hemoglobin units and empty education', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'hemoglobin-visual-first',
    date: '2026-09-01',
    biomarkers: [{ name: 'Hemoglobin', value: 14.5, unit: 'g/dL' }],
  });
  await seedTestReport(page, {
    id: 'hemoglobin-visual-second',
    date: '2026-10-01',
    biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
  });
  await page.goto('/biomarker/718-7');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - Mixed hemoglobin units and empty education',
    testInfo
  );
});

test('Biomarker detail - Red Blood Cells history', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'rbc-visual-first',
    date: '2026-08-01',
    biomarkers: [{ name: 'Red Blood Cells', value: 4.5 }],
  });
  await seedTestReport(page, {
    id: 'rbc-visual-second',
    date: '2026-09-01',
    biomarkers: [{ name: 'Red Blood Cells', value: 4.8 }],
  });
  await page.goto('/biomarker/789-8');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - Red Blood Cells history',
    testInfo
  );
});

test('Biomarker detail - Calculated atherogenic index', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'aip-visual',
    date: '2026-06-01',
    biomarkers: [
      { name: 'Triglycerides', value: 1, unit: 'mmol/L' },
      { name: 'HDL', value: 2.14, unit: 'mmol/L' },
    ],
  });
  await page.goto('/biomarker/aip');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - Calculated atherogenic index',
    testInfo
  );
});

for (const [layout, viewport] of [
  ['mobile', undefined],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`Biomarker detail - Range converted to the result's unit (${layout})`, async ({
    page,
  }, testInfo) => {
    if (viewport) await page.setViewportSize(viewport);
    await seedTestPatient(page);
    // The catalog range is in mg/dL; the laboratory reported mmol/L.
    await seedTestReport(page, {
      id: `magnesium-visual-${layout}`,
      date: '2026-06-01',
      biomarkers: [{ name: 'Magnesium', value: 0.91, unit: 'mmol/L' }],
    });
    await page.goto('/biomarker/19123-9');
    await page.getByTestId('biomarker-title').waitFor();
    await takeSnapshot(
      page,
      `Biomarker detail - Range converted to the result's unit (${layout})`,
      testInfo
    );
  });
}

test('Biomarker detail - Switched to another unit', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'magnesium-visual-older',
    date: '2026-05-01',
    biomarkers: [{ name: 'Magnesium', value: 2.1, unit: 'mg/dL' }],
  });
  await seedTestReport(page, {
    id: 'magnesium-visual-latest',
    date: '2026-06-01',
    biomarkers: [{ name: 'Magnesium', value: 0.91, unit: 'mmol/L' }],
  });
  await page.goto('/biomarker/19123-9');
  // mmol/L, then mEq/L, then mg/dL.
  await page.getByTestId('biomarker-unit-switch').click();
  await expect(page.getByTestId('biomarker-latest-unit')).toHaveText('mEq/L');
  await page.getByTestId('biomarker-unit-switch').click();
  await expect(page.getByTestId('biomarker-latest-value')).toHaveText('2.2');
  await takeSnapshot(
    page,
    'Biomarker detail - Switched to another unit',
    testInfo
  );
});
