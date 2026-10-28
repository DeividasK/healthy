import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
  evaluateBridge,
} from '@/src/features/testing/visualTest';
import { seedRangeHistory } from './rangeTestSeed';
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
    biomarkers: [
      {
        name: 'Red Blood Cells',
        value: 4.5,
        referenceLow: 4.35,
        referenceHigh: 5.65,
      },
    ],
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

test('Biomarker detail - LOINC test outside the catalog', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  const glucose = {
    loinc: '2339-0',
    name: 'Glucose [Mass/volume] in Blood',
    unit: 'mg/dL',
    referenceLow: 70,
    referenceHigh: 99,
  };
  await seedTestReport(page, {
    id: 'loinc-visual-first',
    date: '2026-08-01',
    biomarkers: [{ ...glucose, value: 104 }],
  });
  await seedTestReport(page, {
    id: 'loinc-visual-second',
    date: '2026-10-01',
    biomarkers: [{ ...glucose, value: 92 }],
  });
  await page.goto('/biomarker/2339-0');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - LOINC test outside the catalog',
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
    // The range the user set is in mg/dL; the laboratory reported mmol/L.
    await evaluateBridge(page, (bridge) =>
      bridge.saveProfileSettings({
        biomarkerRanges: {
          '19123-9': [
            {
              low: '1.7',
              high: '2.2',
              unit: 'mg/dL',
              since: '2026-01-01',
              source: 'user',
            },
          ],
        },
      })
    );
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

for (const [layout, viewport] of [
  ['mobile', undefined],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`Biomarker detail - Range set with an optimal part (${layout})`, async ({
    page,
  }, testInfo) => {
    if (viewport) await page.setViewportSize(viewport);
    await seedRangeHistory(page);
    await page.goto('/biomarker/2823-3');
    await page.getByTestId('biomarker-range-list-toggle').click();
    await page.getByTestId('biomarker-range-2026-02-10').waitFor();
    await takeSnapshot(
      page,
      `Biomarker detail - Range set with an optimal part (${layout})`,
      testInfo
    );
  });

  test(`Biomarker detail - No range (${layout})`, async ({
    page,
  }, testInfo) => {
    if (viewport) await page.setViewportSize(viewport);
    await seedTestPatient(page);
    await seedTestReport(page, {
      id: `potassium-visual-none-${layout}`,
      date: '2026-05-12',
      biomarkers: [{ name: 'Potassium', value: 4.4, unit: 'mmol/L' }],
    });
    await page.goto('/biomarker/2823-3');
    await page.getByTestId('biomarker-title').waitFor();
    await takeSnapshot(
      page,
      `Biomarker detail - No range (${layout})`,
      testInfo
    );
  });
}
