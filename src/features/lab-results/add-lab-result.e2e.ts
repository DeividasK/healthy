import { formatLocalDate } from '@/src/utils/dateUtils';
import {
  test,
  expect,
  seedTestPatient,
  checkA11y,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('Add Lab Results Flow (Complete Blood Count)', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test(
    'adds CBC lab results, then views, edits and deletes them',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      await test.step('Open Add Lab Results screen from the empty Home and audit a11y', async () => {
        const addLabResultsMenuBtn = page.getByTestId('start-lab-result');
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
        const home = page.getByTestId('results-scroll-view');
        await expect(home.getByTestId('labs-summary-count')).toHaveText('2');
        await expect(
          home.getByTestId('labs-summary-grid-cell-718-7')
        ).toHaveAccessibleName('Hemoglobin (Hgb): In range');
        await expect(
          home.getByTestId('labs-summary-grid-cell-6690-2')
        ).toHaveAccessibleName('White Blood Cells (WBC): In range');
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
      });

      let reportId = '';
      const results = page.getByTestId('lab-result-results-section');
      await test.step('View its details from the Biomarkers page', async () => {
        await page.getByRole('button', { name: 'Open biomarkers' }).click();
        await expect(page.getByTestId(/^lab-result-card-/)).toContainText(
          'Sep 20, 2026'
        );
        await page.getByTestId(/^lab-result-card-/).click();
        await expect(page).toHaveURL(/lab-result\/[^/]+$/);
        reportId = new URL(page.url()).pathname.split('/').pop()!;
        await expect(page.getByTestId('lab-result-title')).toHaveText(
          'Complete blood count (hemogram) panel - Blood by Automated count'
        );
        await expect(page.getByTestId('lab-result-date')).toContainText(
          'Sep 20, 2026'
        );
        await expect(page.getByTestId('lab-result-status')).toHaveText('Final');
        await expect(page.getByTestId('lab-result-notes')).toHaveText(
          'Fasting routine checkup'
        );
        // A report without a provider shows no provider section.
        await expect(
          page.getByTestId('lab-result-service-provider')
        ).toHaveCount(0);
        await expect(
          page.getByTestId('lab-result-results-section-count')
        ).toHaveText('2');
        await expect(
          results.getByTestId('lab-result-grid-squares').getByRole('button')
        ).toHaveCount(2);
        await expect(
          results.getByTestId('lab-result-groups-inRange-count')
        ).toHaveText('2');
        await expect(results.getByTestId('biomarker-row-718-7')).toContainText(
          '14.5'
        );
        await expect(results.getByTestId('biomarker-row-6690-2')).toContainText(
          '6.8'
        );
        await results.getByTestId('biomarker-row-718-7').click();
        await expect(page).toHaveURL(/biomarker\/718-7$/);
        await page.getByTestId('back-button').click();
      });

      await test.step('Edit it from its view and return to the update', async () => {
        await page.getByTestId('edit-lab-result-button').click();
        await expect(page).toHaveURL(new RegExp(`lab-result/${reportId}/edit`));
        await page.getByTestId('marker-value-input-0').fill('11.2');
        await page.getByTestId('remove-notes-button').click();
        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(new RegExp(`lab-result/${reportId}$`));
        await expect(results.getByTestId('biomarker-row-718-7')).toContainText(
          '11.2'
        );
        await expect(page.getByTestId('lab-result-notes-section')).toHaveCount(
          0
        );
      });

      await test.step('Edit it again: values, tests and notes', async () => {
        await page.getByTestId('edit-lab-result-button').click();
        await expect(page).toHaveURL(new RegExp(`lab-result/${reportId}/edit`));
        await expect(page.getByText('Edit Lab Results')).toBeVisible();
        // Importing with AI only fills in new lab results.
        await expect(page.getByTestId('import-with-ai-button')).toHaveCount(0);
        await expect(page.getByTestId('marker-card-0')).toContainText(
          'Hemoglobin (Hgb)'
        );
        await expect(page.getByTestId('marker-value-input-0')).toHaveValue(
          '11.2'
        );
        await expect(page.getByTestId('marker-card-1')).toContainText(
          'White Blood Cells (WBC)'
        );
        await expect(page.getByTestId('marker-value-input-1')).toHaveValue(
          '6.8'
        );

        await page.getByTestId('marker-value-input-0').fill('16.2');
        await page.getByTestId('remove-marker-1').click();
        await expect(
          page.getByTestId(/^marker-card-/).getByText('White Blood Cells (WBC)')
        ).not.toBeVisible();
        await page.getByTestId('test-search-input').fill('Platelets');
        await page.getByTestId('autocomplete-item-cbc_platelets').click();
        await page.getByTestId('marker-value-input-1').fill('250');
        await page.getByTestId('plus-menu-button').click();
        await page.getByTestId('menu-add-notes').click();
        await page.getByTestId('notes-input').fill('Updated checkup note');
        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(new RegExp(`lab-result/${reportId}$`));

        await expect(results.getByTestId('biomarker-row-718-7')).toContainText(
          '16.2'
        );
        await expect(results.getByTestId('biomarker-row-777-3')).toContainText(
          '250'
        );
        await expect(results.getByTestId('biomarker-row-6690-2')).toHaveCount(
          0
        );
        await expect(page.getByTestId('lab-result-notes')).toHaveText(
          'Updated checkup note'
        );
      });

      await test.step('Delete it from the edit island', async () => {
        await page.getByTestId('edit-lab-result-button').click();
        await page.clock.install();
        await page.getByTestId('delete-report-button').click();
        await expect(
          page.getByTestId('delete-confirmation-modal')
        ).toBeVisible();
        await page.clock.runFor(5000);
        await page.getByTestId('delete-modal-confirm-button').click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByTestId('start-your-record')).toBeVisible();
        await openRoute(page, `/lab-result/${reportId}`);
        await expect(page.getByText('Lab result not found.')).toBeVisible();
      });
    }
  );

  test('fills the form from an AI reply to the copied instructions', async ({
    page,
  }) => {
    await page.getByTestId('start-lab-result').click();
    // An earlier test is replaced by the imported ones.
    await page.getByTestId('test-search-input').fill('MCV');
    await page.getByTestId('autocomplete-item-cbc_mcv').click();

    await test.step('Copy the instructions for the AI', async () => {
      await page.getByTestId('import-with-ai-button').click();
      const modal = page.getByTestId('ai-import-modal-card');
      await expect(
        modal.getByRole('heading', { name: 'Import with AI' })
      ).toBeVisible();
      await expect(page.getByTestId('ai-import-submit-button')).toBeDisabled();
      await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByTestId('ai-import-copy-button').click();
      await expect(
        page.getByRole('button', { name: 'Instructions copied' })
      ).toBeVisible();
      const instructions = await page.evaluate(() =>
        navigator.clipboard.readText()
      );
      expect(instructions).toContain('"healthyLabResults": 1');
      expect(instructions).toContain('- cbc_hemoglobin: Hemoglobin (Hgb)');
      await checkA11y(page);
    });

    await test.step('Problems in the reply are listed', async () => {
      const reply = page.getByTestId('ai-import-reply-input');
      await reply.fill(
        '```json\n{"date": "2026-09-20", "results": [{"test": "Unicorn Factor", "value": 40, "unit": "ng/mL"}]}\n```'
      );
      await page.getByTestId('ai-import-submit-button').click();
      await expect(page.getByTestId('ai-import-errors')).toHaveText(
        '"Unicorn Factor" is not a supported test.'
      );
    });

    await test.step('A pasted reply fills the form for review', async () => {
      const reply = `Unicorn Factor isn't in your list, so I left it out.
\`\`\`json
{
  "healthyLabResults": 1,
  "date": "2026-09-20",
  "time": "08:15",
  "serviceProvider": "City Laboratory",
  "results": [
    { "test": "cbc_hemoglobin", "value": 14.5, "unit": "g/dL" },
    { "test": "cbc_wbc", "value": 6.8, "unit": "10^9/L" },
    { "test": "ferritin", "value": 85, "unit": "ng/mL" },
    { "test": "ldl_calculated", "value": 2.4, "unit": "mmol/L" }
  ]
}
\`\`\``;
      await page.evaluate((text) => navigator.clipboard.writeText(text), reply);
      await page.getByRole('button', { name: 'Paste AI reply' }).click();
      await expect(page.getByTestId('ai-import-reply-input')).toHaveValue(
        reply
      );
      await page.getByTestId('ai-import-submit-button').click();
      await expect(page.getByTestId('ai-import-modal-card')).toHaveCount(0);
      await expect(page.getByTestId('date-picker-button')).toContainText(
        'Sep 20'
      );
      await expect(page.getByTestId('time-picker-button')).toContainText(
        '08:15'
      );
      await expect(
        page.getByTestId('lab-result-service-provider-input')
      ).toHaveValue('City Laboratory');
      await expect(page.getByTestId(/^marker-card-/)).toHaveCount(4);
      await expect(page.getByTestId('marker-card-0')).toContainText(
        'Hemoglobin (Hgb)'
      );
      await expect(page.getByTestId('marker-value-input-0')).toHaveValue(
        '14.5'
      );
      await expect(
        page.getByTestId('unit-picker-button-1').locator('select')
      ).toHaveValue('10*9/L');
      await expect(page.getByTestId('marker-value-input-1')).toHaveValue('6.8');
      await expect(page.getByTestId('marker-card-3')).toContainText(
        'LDL Cholesterol'
      );
      await expect(
        page.getByTestId('unit-picker-button-3').locator('select')
      ).toHaveValue('mmol/L');
    });

    await test.step('Saving stores the imported results', async () => {
      await page.getByTestId('save-button').click();
      const home = page.getByTestId('results-scroll-view');
      await expect(home.getByTestId('labs-summary-count')).toHaveText('4');
      await expect(
        home.getByTestId('labs-summary-grid-cell-6690-2')
      ).toHaveAccessibleName('White Blood Cells (WBC): In range');
      await expect(
        home.getByTestId('labs-summary-grid-cell-2276-4')
      ).toHaveAccessibleName('Ferritin: In range');
      await expect(
        home.getByTestId('labs-summary-grid-cell-13457-7')
      ).toHaveAccessibleName('LDL Cholesterol: In range');
    });
  });

  test('should show "Select Test" label and open dropdown with only test names upon clicking the input field', async ({
    page,
  }) => {
    await page.getByTestId('start-lab-result').click();

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
    await page.getByTestId('start-lab-result').click();

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
    await page.getByTestId('start-lab-result').click();
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
