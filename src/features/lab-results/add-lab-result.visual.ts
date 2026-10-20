import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
  openRoute,
} from '@/src/features/testing/visualTest';

test.describe('Add Lab Result View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
    await openRoute(page, '/lab-result/add');
  });

  test('Add Report View - Initial Clean Form', async ({ page }, testInfo) => {
    await page.getByTestId('test-search-input').waitFor();

    await takeSnapshot(page, 'Add Report View - Initial Clean Form', testInfo);
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
    await page.getByTestId('marker-card-1').waitFor();

    await takeSnapshot(
      page,
      'Add Report View - Populated Biomarkers',
      testInfo
    );

    // Prepare the existing expanded-state baseline without another app bootstrap.
    await page.getByTestId('remove-marker-1').click();
    await page.getByTestId('remove-marker-0').click();
    // Set a previous date so time selection is unrestricted
    const dateInput = page
      .getByTestId('date-picker-button')
      .locator('input[type="date"]');
    await dateInput.fill('2026-10-01');

    // Add a marker
    await searchInput.fill('WBC');
    const wbcOption = page.getByTestId('autocomplete-item-cbc_wbc');
    await wbcOption.click();
    await page.getByTestId('marker-value-input-0').fill('5.4');

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

    await page.getByTestId('notes-input').waitFor();

    // Open plus menu and add Service provider; every optional field is shown,
    // so the + is disabled.
    await plusBtn.click();
    await page.getByTestId('menu-add-service-provider').click();
    await waitForMenuToggle(page, 'plus-menu-button', false);
    await page
      .getByTestId('lab-result-service-provider-input')
      .fill('City Laboratory');

    await takeSnapshot(
      page,
      'Add Report View - Expanded Optional Fields',
      testInfo
    );
  });
});
