import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  seedTestTreatment,
} from '@/src/features/testing/visualTest';
import type { Page } from '@playwright/test';

async function seedRecords(page: Page) {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'share-visual-report',
    date: '2026-09-01',
    biomarkers: [
      {
        name: 'Hemoglobin',
        value: 14.5,
        referenceLow: 11.6,
        referenceHigh: 16.6,
      },
      { name: 'Platelets', value: 480, referenceLow: 150, referenceHigh: 450 },
    ],
  });
  await seedTestCondition(page, {
    id: 'share-visual-knee',
    title: 'Left Knee Pain',
    onsetDate: '2026-08-01',
  });
  await seedTestCondition(page, {
    id: 'share-visual-asthma',
    title: 'Asthma',
    onsetDate: '2020-03-01',
  });
  await seedTestTreatment(page, {
    id: 'share-visual-lisinopril',
    title: 'Lisinopril 10mg',
    dosageInstructions: 'Take 1 tablet daily.',
  });
}

// One condition unticked shows the row and its group's partial state.
async function untickOne(page: Page) {
  await page.getByTestId('share-ai-preview').waitFor();
  await page.getByTestId('share-ai-item-conditions:share-visual-knee').click();
}

test.describe('Share with AI - Visual Regression', () => {
  test('Share with AI - Choose records', async ({ page }, testInfo) => {
    await seedRecords(page);
    await page.goto('/share-ai');
    await untickOne(page);
    await takeSnapshot(page, 'Share with AI - Choose records', testInfo);
  });

  test('Share with AI - From a biomarker', async ({ page }, testInfo) => {
    await seedRecords(page);
    await page.goto('/share-ai?biomarker=718-7');
    await page.getByTestId('share-ai-preview').waitFor();
    await takeSnapshot(page, 'Share with AI - From a biomarker', testInfo);
  });

  test('Desktop - Share with AI', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedRecords(page);
    await page.goto('/share-ai');
    await untickOne(page);
    await takeSnapshot(page, 'Desktop - Share with AI', testInfo);
  });
});
