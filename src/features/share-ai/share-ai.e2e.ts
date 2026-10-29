import {
  test,
  expect,
  useSingleColumnLayout,
} from '@/src/features/testing/testStorage';
import {
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  seedTestTreatment,
  openRoute,
} from '@/src/features/testing/testSeed';
import type { Page } from '@playwright/test';

async function seedRecords(page: Page) {
  await seedTestPatient(page);
  await seedTestReport(page, {
    date: '2026-09-01',
    biomarkers: [
      {
        name: 'Hemoglobin',
        value: 14.5,
        referenceLow: 11.6,
        referenceHigh: 16.6,
      },
    ],
  });
  await seedTestCondition(page, {
    id: 'share-knee',
    title: 'Left Knee Pain',
    onsetDate: '2026-08-01',
  });
  await seedTestTreatment(page, {
    id: 'share-lisinopril',
    title: 'Lisinopril 10mg',
    dosageInstructions: 'Take 1 tablet daily.',
  });
}

test.describe('Share with AI', () => {
  test('ticks records in and out of the shared text and copies it', async ({
    page,
  }) => {
    await seedRecords(page);
    await openRoute(page, '/');
    await page.getByTestId('home-share').click();
    await expect(page).toHaveURL(/\/share-ai$/);

    const preview = page.getByTestId('share-ai-preview');
    await expect(preview).toContainText('Left Knee Pain');
    await expect(preview).toContainText('Lisinopril 10mg');
    await expect(preview).not.toContainText('Test Patient');

    // Unticking a row leaves it out; its group shows some ticked.
    await page.getByTestId('share-ai-item-conditions:share-knee').click();
    await expect(preview).not.toContainText('Left Knee Pain');
    await expect(
      page.getByTestId('share-ai-group-conditions-checkbox')
    ).toHaveAttribute('aria-checked', 'false');

    // The group checkbox ticks the whole group back in.
    await page.getByTestId('share-ai-group-conditions-checkbox').click();
    await expect(preview).toContainText('Left Knee Pain');

    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('share-ai-copy-button').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('# My health records');
    expect(copied).toContain('Lisinopril 10mg');

    // The preview box copies the same text from its corner.
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await page.getByTestId('share-ai-preview-copy-button').click();
    await expect(
      page.getByRole('button', { name: 'Shared text copied' })
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      copied
    );
  });

  test('opens from a biomarker with its history and no treatments', async ({
    page,
  }) => {
    await useSingleColumnLayout(page);
    await seedRecords(page);
    await openRoute(page, '/biomarker/718-7');
    await page.getByTestId('biomarker-share').click();
    await expect(page).toHaveURL(/\/share-ai\?biomarker=718-7$/);

    const preview = page.getByTestId('share-ai-preview');
    await expect(preview).toContainText('14.5');
    await expect(preview).toContainText('Left Knee Pain');
    await expect(preview).not.toContainText('Lisinopril 10mg');
    await expect(
      page.getByTestId('share-ai-group-treatments-checkbox')
    ).toHaveAttribute('aria-checked', 'false');
  });
});
