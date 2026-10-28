import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
  evaluateBridge,
} from '@/src/features/testing/visualTest';
import { seedRangeHistory } from './rangeTestSeed';

// With no printed or user range, this page also owns the No range state.
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

test('Biomarker detail - Switched to another unit', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  // The range is in mmol/L; the page shows mg/dL, so its limits are
  // converted and rounded: 0.7-0.91 mmol/L becomes 1.7-2.2 mg/dL, and the
  // latest 2.2 sits on the rounded upper limit, in range.
  await evaluateBridge(page, (bridge) =>
    bridge.saveProfileSettings({
      biomarkerRanges: {
        '19123-9': [
          {
            low: '0.7',
            high: '0.91',
            unit: 'mmol/L',
            since: '2026-01-01',
            source: 'user',
          },
        ],
      },
    })
  );
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
  await page
    .getByTestId('biomarker-latest-unit')
    .filter({ hasText: /^mEq\/L$/ })
    .waitFor();
  await page.getByTestId('biomarker-unit-switch').click();
  await page
    .getByTestId('biomarker-latest-unit')
    .filter({ hasText: /^mg\/dL$/ })
    .waitFor();
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
}
