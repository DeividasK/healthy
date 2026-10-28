import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import type { Page } from '@playwright/test';

/** Adds Telomere length as an own test at `index`, with a value and unit. */
async function addOwnTest(page: Page, index: number) {
  await page.getByTestId('test-search-input').fill('Telomere length');
  await page.getByTestId('autocomplete-add-custom').click();
  await page.getByTestId(`marker-value-input-${index}`).fill('6.8');
  await page.getByTestId(`marker-unit-input-${index}`).fill('kb');
}

test.describe('Add Lab Result View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
    await page.goto('/lab-result/add');
  });

  test('Add Report View - Populated Biomarkers', async ({ page }, testInfo) => {
    const searchInput = page.getByTestId('test-search-input');

    // Add Hemoglobin
    await searchInput.fill('Hemoglobin');
    const hemoglobinOption = page.getByTestId(
      'autocomplete-item-cbc_hemoglobin'
    );
    await hemoglobinOption.click();
    await page.getByTestId('marker-value-input-0').fill('14.2');

    // Add Platelets
    await searchInput.fill('Platelets');
    const plateletsOption = page.getByTestId('autocomplete-item-cbc_platelets');
    await plateletsOption.click();
    await page.getByTestId('marker-value-input-1').fill('260');
    await page.getByTestId('marker-range-low-0').fill('13.5');
    await page.getByTestId('marker-range-high-0').fill('17.0');
    await page.getByTestId('marker-card-1').waitFor();

    // The website crops this snapshot (scripts/site-screens.mjs): keep it.
    await takeSnapshot(
      page,
      'Add Report View - Populated Biomarkers',
      testInfo
    );

    // A printed range, a value without one and an own test, with every
    // optional field shown, so the + is disabled.
    await addOwnTest(page, 2);
    await page.getByTestId('marker-card-2').waitFor();
    // Set a previous date so time selection is unrestricted
    const dateInput = page
      .getByTestId('date-picker-button')
      .locator('input[type="date"]');
    await dateInput.fill('2026-10-01');

    // Open plus menu and add Time
    const plusBtn = page.getByTestId('plus-menu-button');
    await plusBtn.click();
    await page.getByTestId('menu-add-time').click();
    await waitForMenuToggle(page, 'plus-menu-button', false);

    // Set custom time
    const timeInput = page
      .getByTestId('time-picker-button')
      .locator('input[type="time"]');
    await timeInput.fill('08:45');

    // Open plus menu and add Notes
    await plusBtn.click();
    await page.getByTestId('menu-add-notes').click();
    await waitForMenuToggle(page, 'plus-menu-button', false);
    await page
      .getByTestId('notes-input')
      .fill('Fasting morning blood sample taken at clinic');

    // Open plus menu and add Service provider
    await plusBtn.click();
    await page.getByTestId('menu-add-service-provider').click();
    await waitForMenuToggle(page, 'plus-menu-button', false);
    await page
      .getByTestId('lab-result-service-provider-input')
      .fill('City Laboratory');

    await takeSnapshot(page, 'Add Report View - Filled form', testInfo);

    await page.getByTestId('import-with-ai-button').click();
    await page
      .getByTestId('ai-import-reply-input')
      .fill('{"date": "2026-09-20", "results": []}');
    await page.getByTestId('ai-import-submit-button').click();
    await page.getByTestId('ai-import-errors').waitFor();

    await takeSnapshot(page, 'Add Report View - Import with AI', testInfo);
  });

  test('Add Report View - Printed range - Desktop', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('Hemoglobin');
    await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
    await page.getByTestId('marker-value-input-0').fill('14.2');
    await page.getByTestId('marker-range-low-0').fill('13.5');
    await page.getByTestId('marker-range-high-0').fill('17.0');
    await searchInput.fill('Platelets');
    await page.getByTestId('autocomplete-item-cbc_platelets').click();
    await page.getByTestId('marker-value-input-1').fill('260');
    await addOwnTest(page, 2);
    await page.getByTestId('marker-card-2').waitFor();
    await takeSnapshot(
      page,
      'Add Report View - Printed range - Desktop',
      testInfo
    );
  });

  test('Add Report View - Add own test from search', async ({
    page,
  }, testInfo) => {
    await page.getByTestId('test-search-input').fill('Telomere length');
    await page.getByTestId('autocomplete-add-custom').waitFor();
    // The suggestion list shows only while the search keeps focus.
    await takeSnapshot(
      page,
      'Add Report View - Add own test from search',
      testInfo,
      { keepFocus: true }
    );
  });
});
