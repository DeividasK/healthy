import { formatLocalDate } from '@/src/utils/dateUtils';
import {
  test,
  expect,
  seedTestPatient,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Add Lab Results Flow (Complete Blood Count)', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test(
    'should allow user to add CBC lab results and view them on home',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      await test.step('Open Add Lab Results screen from floating button and audit a11y', async () => {
        await page.getByTestId('floating-add-button').click();
        const addLabResultsMenuBtn = page.getByTestId('menu-add-lab-results');
        await expect(addLabResultsMenuBtn).toBeVisible();
        await addLabResultsMenuBtn.click();

        await expect(page).toHaveURL(/.*lab-result\/add/);
        await expect(
          page.getByRole('heading', { name: 'Add Lab Results', exact: true })
        ).toBeVisible();
        await expect(addLabResultsMenuBtn).not.toBeVisible();
        await checkA11y(page);
      });

      await test.step('Search and select Hemoglobin and WBC biomarkers', async () => {
        const searchInput = page.getByTestId('test-search-input');
        await searchInput.fill('Platelets');
        await page.getByTestId('autocomplete-item-cbc_platelets').click();
        await expect(page.getByTestId('marker-card-0')).toBeVisible();
        await page.getByTestId('remove-marker-0').click();
        await expect(page.getByTestId('marker-card-0')).toHaveCount(0);

        await searchInput.fill('Hemoglobin');
        const hemoglobinOption = page.getByTestId(
          'autocomplete-item-cbc_hemoglobin'
        );
        await expect(hemoglobinOption).toBeVisible();
        await hemoglobinOption.click();

        await expect(searchInput).toHaveValue('');
        const hemoglobinCard = page.getByTestId('marker-card-0');
        await expect(hemoglobinCard).toBeVisible();
        await expect(
          hemoglobinCard.getByText('Hemoglobin (Hgb)')
        ).toBeVisible();

        await searchInput.fill('WBC');
        const wbcOption = page.getByTestId('autocomplete-item-cbc_wbc');
        await expect(wbcOption).toBeVisible();
        await wbcOption.click();

        const nativeSelect = page
          .getByTestId('unit-picker-button-1')
          .locator('select');
        await expect(nativeSelect).toHaveValue('10*3/uL');
        await nativeSelect.selectOption('10*9/L');
        await expect(nativeSelect).toHaveValue('10*9/L');
        const wbcCard = page.getByTestId('marker-card-1');
        await expect(wbcCard).toBeVisible();
        await expect(
          wbcCard.getByText('White Blood Cells (WBC)')
        ).toBeVisible();
      });

      await test.step('Enter numeric biomarker values', async () => {
        const hemoglobinInput = page.getByTestId('marker-value-input-0');
        await hemoglobinInput.fill('14.5');

        const wbcInput = page.getByTestId('marker-value-input-1');
        await wbcInput.fill('6.8');
      });

      await test.step('Add notes via plus menu and save', async () => {
        const plusMenuBtn = page.getByTestId('plus-menu-button');
        await plusMenuBtn.click();
        const addNotesOption = page.getByTestId('menu-add-notes');
        await expect(addNotesOption).toBeVisible();
        await addNotesOption.click();

        const notesInput = page.getByTestId('notes-input');
        await expect(notesInput).toBeVisible();
        await notesInput.fill('Fasting routine checkup');

        // Date and an added time use native inputs behind their buttons.
        await expect(page.getByTestId('menu-add-time')).toHaveCount(0);
        await page
          .getByTestId('date-picker-button')
          .locator('input[type="date"]')
          .fill('2026-09-20');
        await expect(page.getByTestId('date-picker-button')).toContainText(
          'Sep 20'
        );
        await plusMenuBtn.click();
        await page.getByTestId('menu-add-time').click();
        await page
          .getByTestId('time-picker-button')
          .locator('input[type="time"]')
          .fill('08:15');
        await expect(page.getByTestId('time-picker-button')).toContainText(
          '08:15'
        );

        const saveButton = page.getByTestId('save-button');
        await expect(saveButton).toBeVisible();
        await saveButton.click();
      });

      await test.step('Verify saved results render on Home', async () => {
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('Hemoglobin (Hgb)')
        ).toBeVisible();
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('14.5')
        ).toBeVisible();
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('White Blood Cells (WBC)')
        ).toBeVisible();
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('6.8')
        ).toBeVisible();
        const stored = await page.evaluate(() =>
          (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
            'SELECT fhir_json FROM observations'
          )
        );
        expect(
          stored
            .map((row: { fhir_json: string }) => JSON.parse(row.fhir_json))
            .find((resource: any) => resource.code.coding[0].code === '6690-2')
            .valueQuantity.code
        ).toBe('10*9/L');

        await expect(page.getByText('"Fasting routine checkup"')).toBeVisible();
      });
    }
  );

  test('should show "Select Test" label and open dropdown with only test names upon clicking the input field', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    // Label should read "Select Test"
    await expect(page.getByText('Select Test', { exact: true })).toBeVisible();

    // Click on input field without typing
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.click();

    // Dropdown list should be visible immediately with options
    const autocompleteList = page.getByTestId('autocomplete-list');
    await expect(autocompleteList).toBeVisible();
    const wbcItem = page.getByTestId('autocomplete-item-cbc_wbc');
    await expect(wbcItem).toBeVisible();
    await expect(wbcItem).toHaveText('White Blood Cells (WBC)');
    // Verify no subtitles or LOINC codes in dropdown
    await expect(wbcItem).not.toContainText('LOINC:');
    await expect(page.getByTestId('autocomplete-item-cbc_rbc')).toBeVisible();
    await expect(
      page.getByTestId('autocomplete-item-cbc_hemoglobin')
    ).toBeVisible();

    // Clicking outside the Test input box should close the dropdown
    await page.getByText('Add Lab Results').click();
    await expect(autocompleteList).not.toBeVisible();

    // Re-focus search input -> dropdown appears
    await searchInput.focus();
    await expect(autocompleteList).toBeVisible();

    // Tab into the first element in the dropdown -> dropdown stays open and item receives focus
    await page.keyboard.press('Tab');
    await expect(autocompleteList).toBeVisible();
    await expect(wbcItem).toBeFocused();

    // Tab to the next element in the dropdown
    await page.keyboard.press('Tab');
    await expect(autocompleteList).toBeVisible();
    await expect(page.getByTestId('autocomplete-item-cbc_rbc')).toBeFocused();

    // Shift+Tab back to the first element and then to input
    await page.keyboard.press('Shift+Tab');
    await expect(wbcItem).toBeFocused();
    await expect(autocompleteList).toBeVisible();

    // Click outside -> dropdown disappears
    await page.getByText('Add Lab Results').click();
    await expect(autocompleteList).not.toBeVisible();
  });

  test('should fit value input and unit picker completely within the card without overflowing the window', async ({
    page,
  }) => {
    // Set small mobile viewport
    await page.setViewportSize({ width: 360, height: 740 });
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    // Add RDW-CV
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('RDW-CV');
    const rdwOption = page.getByTestId('autocomplete-item-cbc_rdw_cv');
    await rdwOption.click();

    const card = page.getByTestId('marker-card-0');
    await expect(card).toBeVisible();

    const unitPicker = page.getByTestId('unit-picker-button-0');
    await expect(unitPicker).toBeVisible();

    // Verify bounding box of unit picker does not exceed card width or window width
    const cardBox = await card.boundingBox();
    const unitPickerBox = await unitPicker.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(unitPickerBox).not.toBeNull();
    if (cardBox && unitPickerBox) {
      expect(unitPickerBox.x + unitPickerBox.width).toBeLessThanOrEqual(
        cardBox.x + cardBox.width + 1
      );
      expect(unitPickerBox.x + unitPickerBox.width).toBeLessThanOrEqual(360);
    }
  });

  test('limits date and time to now and pulls a later time back when the date returns to today', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();
    const dateInput = page
      .getByTestId('date-picker-button')
      .locator('input[type="date"]');
    const timeInput = page
      .getByTestId('time-picker-button')
      .locator('input[type="time"]');
    await expect(dateInput).toHaveAttribute('max', formatLocalDate(new Date()));

    // A past date allows any time
    await dateInput.fill('2026-09-20');
    await page.getByTestId('plus-menu-button').click();
    await page.getByTestId('menu-add-time').click();
    await timeInput.fill('23:55');
    await expect(page.getByTestId('time-picker-button')).toContainText('23:55');

    // Back on today the later time resets to now, without an alert
    let dialogTriggered = false;
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.accept();
    });
    const now = new Date();
    await dateInput.fill(formatLocalDate(now));
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    await expect(page.getByTestId('time-picker-button')).toContainText(
      currentTime
    );
    expect(dialogTriggered).toBe(false);
    // Today's time cannot go past now either
    expect(await timeInput.getAttribute('max')).toBeTruthy();
  });
});
