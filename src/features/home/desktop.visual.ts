import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
} from '@/src/features/testing/visualTest';

// Desktop windows: the sidebar, side-by-side columns and the shortcut list.
test.describe('Desktop - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedTestPatient(page);
    await seedTestReport(page, {
      id: 'desktop-visual-report',
      date: '2026-10-02',
      biomarkers: [
        {
          name: 'Hemoglobin',
          value: 15.2,
          referenceLow: 11.6,
          referenceHigh: 16.6,
        },
        {
          name: 'White Blood Cells',
          value: 3.1,
          referenceLow: 4.5,
          referenceHigh: 11,
        },
        {
          name: 'Platelets',
          value: 480,
          referenceLow: 150,
          referenceHigh: 450,
        },
        {
          name: 'Red Blood Cells',
          value: 4.7,
          referenceLow: 3.92,
          referenceHigh: 5.65,
        },
      ],
    });
    await seedTestReport(page, {
      id: 'desktop-visual-older',
      date: '2026-06-02',
      biomarkers: [
        {
          name: 'Hemoglobin',
          value: 14.1,
          referenceLow: 11.6,
          referenceHigh: 16.6,
        },
        {
          name: 'White Blood Cells',
          value: 4.2,
          referenceLow: 4.5,
          referenceHigh: 11,
        },
      ],
    });
  });

  test('Desktop - Home overview', async ({ page }, testInfo) => {
    await seedTestCondition(page, {
      id: 'desktop-visual-condition',
      title: 'Left Knee Pain',
      onsetDate: '2026-10-02',
    });
    await seedTestTreatment(page, {
      id: 'desktop-visual-treatment',
      title: 'Lisinopril 10mg',
      dosageInstructions: 'Take 1 tablet daily.',
    });
    await seedTestConsultation(page, {
      id: 'desktop-visual-consultation',
      title: 'Annual Physical Exam',
      date: '2026-10-04',
      doctorName: 'Dr. Sarah Connor',
    });
    await page.goto('/');
    await page.getByTestId('condition-card-desktop-visual-condition').waitFor();
    await page
      .getByTestId('results-scroll-view')
      .getByTestId('labs-summary-grid-cell-718-7')
      .waitFor();
    await takeSnapshot(page, 'Desktop - Home overview', testInfo);
  });

  test('Desktop - Biomarkers beside the detail', async ({ page }, testInfo) => {
    await page.goto('/labs-summary');
    await page
      .getByTestId('labs-summary-view')
      .getByTestId('biomarker-title')
      .waitFor();
    await takeSnapshot(
      page,
      'Desktop - Biomarkers beside the detail',
      testInfo
    );
  });

  test('Desktop - Biomarker page in two columns', async ({
    page,
  }, testInfo) => {
    await page.goto('/biomarker/718-7');
    await page.getByTestId('biomarker-title').waitFor();
    await takeSnapshot(
      page,
      'Desktop - Biomarker page in two columns',
      testInfo
    );
  });

  test('Desktop - Keyboard shortcuts', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('app-sidebar').waitFor();
    await page.getByTestId('keyboard-shortcuts-button').click();
    await page.getByTestId('keyboard-shortcuts').waitFor();
    await takeSnapshot(page, 'Desktop - Keyboard shortcuts', testInfo);
  });
});
