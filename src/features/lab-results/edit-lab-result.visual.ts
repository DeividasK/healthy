import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { seedReports } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Edit Lab Result View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Add Report View - Edit Existing Mode', async ({ page }, testInfo) => {
    const editReportId = 'report-to-edit';
    await seedReports(page, [
      {
        id: editReportId,
        effectiveDate: '2026-09-26',
        effectiveDateTime: '2026-09-26T07:15:00.000Z',
        notes: 'Initial checkup notes for editing',
        observations: [
          {
            name: 'Hemoglobin (Hgb)',
            loinc: '718-7',
            value: 13.8,
            unit: 'g/dL',
            interpretationCode: 'N',
          },
          {
            name: 'Platelets (PLT)',
            loinc: '777-3',
            value: 210,
            unit: '10*3/uL',
            interpretationCode: 'N',
          },
        ],
      },
    ]);

    await page.goto(`/lab-result/${editReportId}/edit`);

    await expect(page.getByText('Edit Lab Results')).toBeVisible();
    await expect(page.getByTestId('marker-card-0')).toContainText(
      'Hemoglobin (Hgb)'
    );
    await expect(page.getByTestId('marker-value-input-0')).toHaveValue('13.8');
    await expect(page.getByTestId('notes-input')).toHaveValue(
      'Initial checkup notes for editing'
    );

    await takeSnapshot(page, 'Add Report View - Edit Existing Mode', testInfo);
  });
});
