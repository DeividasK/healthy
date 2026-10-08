import { formatLocalDate } from '@/src/utils/dateUtils';
import {
  test,
  expect,
  clearAppStorage,
  createPatientViaUI,
} from '@/src/features/testing/testStorage';

test.describe('Add Lab Results Flow (Complete Blood Count)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
  });

  test('should allow user to add CBC lab results and view them on home', async ({
    page,
  }) => {
    // 2. Click floating "+" button -> "Add Lab Results"
    await page.getByTestId('floating-add-button').click();
    const addLabResultsMenuBtn = page.getByTestId('menu-add-lab-results');
    await expect(addLabResultsMenuBtn).toBeVisible();
    await addLabResultsMenuBtn.click();

    // 3. Verify navigation to Add Lab Results screen
    await expect(page).toHaveURL(/.*lab-result\/add/);
    await expect(page.getByText('Add Lab Results')).toBeVisible();

    // 4. Search and select "Hemoglobin" from CBC autocomplete
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('Hemoglobin');
    const hemoglobinOption = page.getByTestId(
      'autocomplete-item-cbc_hemoglobin'
    );
    await expect(hemoglobinOption).toBeVisible();
    await hemoglobinOption.click();

    // Verify search input is cleared and Hemoglobin card is added
    await expect(searchInput).toHaveValue('');
    const hemoglobinCard = page.getByTestId('marker-card-0');
    await expect(hemoglobinCard).toBeVisible();
    await expect(hemoglobinCard.getByText('Hemoglobin (Hgb)')).toBeVisible();

    // 5. Search and select "White Blood Cells (WBC)"
    await searchInput.fill('WBC');
    const wbcOption = page.getByTestId('autocomplete-item-cbc_wbc');
    await expect(wbcOption).toBeVisible();
    await wbcOption.click();

    const wbcCard = page.getByTestId('marker-card-1');
    await expect(wbcCard).toBeVisible();
    await expect(wbcCard.getByText('White Blood Cells (WBC)')).toBeVisible();

    // 6. Enter numeric values for both biomarkers
    const hemoglobinInput = page.getByTestId('marker-value-input-0');
    await hemoglobinInput.fill('14.5');

    const wbcInput = page.getByTestId('marker-value-input-1');
    await wbcInput.fill('6.8');

    // 7. Click "+" menu button and add notes
    const plusMenuBtn = page.getByTestId('plus-menu-button');
    await plusMenuBtn.click();
    const addNotesOption = page.getByTestId('menu-add-notes');
    await expect(addNotesOption).toBeVisible();
    await addNotesOption.click();

    const notesInput = page.getByTestId('notes-input');
    await expect(notesInput).toBeVisible();
    await notesInput.fill('Fasting routine checkup');

    // 8. Click bottom Save button
    const saveButton = page.getByTestId('save-button');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // 9. Verify navigation back to home page
    await expect(page).toHaveURL(/.*(\/|#)$/);

    // 10. Verify that Homepage shows the results (only)
    await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
    await expect(page.getByText('14.5')).toBeVisible();
    await expect(page.getByText('White Blood Cells (WBC)')).toBeVisible();
    await expect(page.getByText('6.8')).toBeVisible();
    await expect(page.getByText('"Fasting routine checkup"')).toBeVisible();
  });

  test('should allow removing a test from the active list before saving', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    // Add Platelets
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('Platelets');
    const plateletsOption = page.getByTestId('autocomplete-item-cbc_platelets');
    await plateletsOption.click();

    await expect(page.getByTestId('marker-card-0')).toBeVisible();

    // Click remove button (X)
    const removeBtn = page.getByTestId('remove-marker-0');
    await removeBtn.click();

    // Verify card is removed
    await expect(page.getByTestId('marker-card-0')).not.toBeVisible();
  });

  test('should open and update date and time via native dropdown inputs', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    // Verify date picker button has native date input and updates with valid past date
    const dateInput = page
      .getByTestId('date-picker-button')
      .locator('input[type="date"]');
    await expect(dateInput).toBeAttached();
    await dateInput.fill('2026-09-20');
    await expect(page.getByTestId('date-picker-button')).toContainText(
      'Sep 20'
    );

    // Add time from plus menu
    const plusMenuBtn = page.getByTestId('plus-menu-button');
    await plusMenuBtn.click();
    await page.getByTestId('menu-add-time').click();

    // Verify time picker button has native time input and updates
    const timeInput = page
      .getByTestId('time-picker-button')
      .locator('input[type="time"]');
    await expect(timeInput).toBeAttached();
    await timeInput.fill('08:15');
    await expect(page.getByTestId('time-picker-button')).toContainText('08:15');
  });

  test('should hide plus menu options and plus button when time and notes are added, and reappear when removed', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    const plusBtn = page.getByTestId('plus-menu-button');
    await expect(plusBtn).toBeVisible();

    // 1. Add Time
    await plusBtn.click();
    await expect(page.getByTestId('menu-add-time')).toBeVisible();
    await expect(page.getByTestId('menu-add-notes')).toBeVisible();
    await page.getByTestId('menu-add-time').click();

    // Time pill is visible
    await expect(page.getByTestId('time-picker-button')).toBeVisible();

    // 2. Open plus menu again: "Add Time" should no longer appear
    await plusBtn.click();
    await expect(page.getByTestId('menu-add-time')).not.toBeVisible();
    await expect(page.getByTestId('menu-add-notes')).toBeVisible();

    // 3. Add Notes
    await page.getByTestId('menu-add-notes').click();
    await expect(page.getByTestId('notes-input')).toBeVisible();

    // 4. Once BOTH Time and Notes are added, plus button must disappear
    await expect(plusBtn).not.toBeVisible();

    // 5. Remove Notes -> plus button should reappear
    await page.getByTestId('remove-notes-button').click();
    await expect(page.getByTestId('notes-input')).not.toBeVisible();
    await expect(plusBtn).toBeVisible();

    // 6. Click plus button: only "Add Notes" should be shown
    await plusBtn.click();
    await expect(page.getByTestId('menu-add-time')).not.toBeVisible();
    await page
      .getByTestId('plus-menu-overlay')
      .click({ position: { x: 5, y: 5 } });

    // 7. Remove Time -> "Add Time" should reappear in menu
    await page.getByTestId('remove-time-button').click();
    await expect(page.getByTestId('time-picker-button')).not.toBeVisible();
    await plusBtn.click();
    await expect(page.getByTestId('menu-add-time')).toBeVisible();
    await expect(page.getByTestId('menu-add-notes')).toBeVisible();
  });

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

  test('should change biomarker unit using native dropdown', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    // Add WBC (units: '10*3/uL', '10*9/L', '/uL')
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('WBC');
    await page.getByTestId('autocomplete-item-cbc_wbc').click();

    const unitPicker = page.getByTestId('unit-picker-button-0');
    await expect(unitPicker).toContainText('10*3/uL');

    // Native select element should exist
    const nativeSelect = unitPicker.locator('select');
    await expect(nativeSelect).toBeAttached();

    // Select alternative unit: '10*9/L'
    await nativeSelect.selectOption('10*9/L');
    await expect(unitPicker).toContainText('10*9/L');
  });

  test('should validate that date and time cannot be set to the future', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    // 1. Verify native date input has max attribute set to today
    const dateInput = page
      .getByTestId('date-picker-button')
      .locator('input[type="date"]');
    const todayStr = formatLocalDate(new Date());
    await expect(dateInput).toHaveAttribute('max', todayStr);

    // 2. Add a test item
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('Hemoglobin');
    await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
    await page.getByTestId('marker-value-input-0').fill('15.0');

    // 3. Add Time
    const plusBtn = page.getByTestId('plus-menu-button');
    await plusBtn.click();
    await page.getByTestId('menu-add-time').click();

    // 4. Verify time picker has max attribute on the native time input when date is today
    const timeInput = page
      .getByTestId('time-picker-button')
      .locator('input[type="time"]');
    await expect(timeInput).toBeAttached();
    const maxAttr = await timeInput.getAttribute('max');
    expect(maxAttr).toBeTruthy();
  });

  test('should reset future time to current time without throwing an alert when reverting to today from a past date', async ({
    page,
  }) => {
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-lab-results').click();

    // 1. Select a past date (2026-09-20)
    const dateInput = page
      .getByTestId('date-picker-button')
      .locator('input[type="date"]');
    await dateInput.fill('2026-09-20');

    // 2. Add Time: select 23:55 (allowed since date was in the past)
    const plusBtn = page.getByTestId('plus-menu-button');
    await plusBtn.click();
    await page.getByTestId('menu-add-time').click();

    const timeInput = page
      .getByTestId('time-picker-button')
      .locator('input[type="time"]');
    await timeInput.fill('23:55');
    await expect(page.getByTestId('time-picker-button')).toContainText('23:55');

    // Ensure NO dialog/alert is thrown
    let dialogTriggered = false;
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.accept();
    });

    // 3. Revert date back to today
    const now = new Date();
    const todayStr = formatLocalDate(now);
    await dateInput.fill(todayStr);

    // 4. Verify no alert was thrown
    expect(dialogTriggered).toBe(false);

    // 5. Verify that time was reset to current time instead of remaining 23:55
    const expectedCurrentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    await expect(page.getByTestId('time-picker-button')).toContainText(
      expectedCurrentTime
    );
    await expect(page.getByTestId('time-picker-button')).not.toContainText(
      '23:55'
    );
  });
});
