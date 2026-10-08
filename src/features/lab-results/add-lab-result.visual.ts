import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage, createPatientViaUI } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Add Lab Result View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
  });

  test('Add Report View - Initial Clean Form', async ({ page }, testInfo) => {
    await page.goto('/lab-result/add');

    await expect(page.getByText('Add Lab Results')).toBeVisible();
    await expect(page.getByTestId('date-picker-button')).toBeVisible();
    await expect(page.getByTestId('test-search-input')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(page, 'Add Report View - Initial Clean Form', testInfo);
  });

  test('Add Report View - Autocomplete Dropdown Open', async ({
    page,
  }, testInfo) => {
    await page.goto('/lab-result/add');

    const searchInput = page.getByTestId('test-search-input');
    await searchInput.click();

    const autocompleteList = page.getByTestId('autocomplete-list');
    await expect(autocompleteList).toBeVisible();
    await expect(
      page.getByTestId('autocomplete-item-cbc_hemoglobin')
    ).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(
      page,
      'Add Report View - Autocomplete Dropdown Open',
      testInfo
    );
  });

  test('Add Report View - Populated Biomarkers', async ({ page }, testInfo) => {
    await page.goto('/lab-result/add');

    const searchInput = page.getByTestId('test-search-input');

    // Add Hemoglobin
    await searchInput.fill('Hemoglobin');
    await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
    await page.getByTestId('marker-value-input-0').fill('14.2');

    // Add Platelets
    await searchInput.fill('Platelets');
    await page.getByTestId('autocomplete-item-cbc_platelets').click();
    await page.getByTestId('marker-value-input-1').fill('260');

    await expect(page.getByTestId('marker-card-0')).toBeVisible();
    await expect(page.getByTestId('marker-card-1')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(
      page,
      'Add Report View - Populated Biomarkers',
      testInfo
    );
  });

  test('Add Report View - Expanded Time and Notes', async ({
    page,
  }, testInfo) => {
    await page.goto('/lab-result/add');

    // Add a marker
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('WBC');
    await page.getByTestId('autocomplete-item-cbc_wbc').click();
    await page.getByTestId('marker-value-input-0').fill('5.4');

    // Open plus menu and add Time
    const plusBtn = page.getByTestId('plus-menu-button');
    await plusBtn.click();
    await page.getByTestId('menu-add-time').click();

    // Set custom time
    const timeInput = page
      .getByTestId('time-picker-button')
      .locator('input[type="time"]');
    await timeInput.fill('08:45');

    // Open plus menu and add Notes
    await plusBtn.click();
    await page.getByTestId('menu-add-notes').click();
    await page
      .getByTestId('notes-input')
      .fill('Fasting morning blood sample taken at clinic');

    await expect(page.getByTestId('time-picker-button')).toContainText('08:45');
    await expect(page.getByTestId('notes-input')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(
      page,
      'Add Report View - Expanded Time and Notes',
      testInfo
    );
  });
});
