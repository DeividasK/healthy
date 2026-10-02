import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage, seedReports } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Home View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Home View - Empty State', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await page.goto('/');

    await expect(page.getByText('Nothing to show yet')).toBeVisible();
    await expect(page.getByTestId('floating-add-button')).toBeVisible();

    await takeSnapshot(page, 'Home View - Empty State', testInfo);
  });

  test('Home View - Populated with Single Report', async ({
    page,
  }, testInfo) => {
    await seedReports(page, [
      {
        id: 'report-single',
        effectiveDate: '2026-09-26',
        effectiveDateTime: '2026-09-26T08:30:00.000Z',
        notes: 'Routine morning blood test',
        observations: [
          {
            name: 'Hemoglobin (Hgb)',
            loinc: '718-7',
            value: 14.5,
            unit: 'g/dL',
            interpretationCode: 'N',
          },
          {
            name: 'White Blood Cells (WBC)',
            loinc: '6690-2',
            value: 6.8,
            unit: '10*3/uL',
            interpretationCode: 'N',
          },
        ],
      },
    ]);

    await page.goto('/');
    await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
    await expect(page.getByText('"Routine morning blood test"')).toBeVisible();

    await takeSnapshot(page, 'Home View - Populated Single Report', testInfo);
  });

  test('Home View - Multi-Report with All Status Badges', async ({
    page,
  }, testInfo) => {
    await seedReports(page, [
      {
        id: 'report-1',
        effectiveDate: '2026-09-26',
        effectiveDateTime: '2026-09-26T09:15:00.000Z',
        notes: 'Follow-up consultation notes',
        observations: [
          {
            name: 'Hemoglobin (Hgb)',
            loinc: '718-7',
            value: 15.2,
            unit: 'g/dL',
            interpretationCode: 'N',
          },
          {
            name: 'White Blood Cells (WBC)',
            loinc: '6690-2',
            value: 3.1,
            unit: '10*3/uL',
            interpretationCode: 'L',
          },
          {
            name: 'Platelets (PLT)',
            loinc: '777-3',
            value: 480,
            unit: '10*3/uL',
            interpretationCode: 'H',
          },
        ],
      },
      {
        id: 'report-2',
        effectiveDate: '2026-08-10',
        effectiveDateTime: '2026-08-10',
        observations: [
          {
            name: 'Red Blood Cells (RBC)',
            loinc: '789-8',
            value: 4.7,
            unit: '10*6/uL',
            interpretationCode: 'N',
          },
          {
            name: 'Hematocrit (Hct)',
            loinc: '4544-3',
            value: 41.5,
            unit: '%',
            interpretationCode: 'N',
          },
        ],
      },
    ]);

    await page.goto('/');
    await expect(
      page.getByText('Normal', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText('Low', { exact: true })).toBeVisible();
    await expect(page.getByText('High', { exact: true })).toBeVisible();

    await takeSnapshot(
      page,
      'Home View - Multi-Report with Status Badges',
      testInfo
    );
  });
});
