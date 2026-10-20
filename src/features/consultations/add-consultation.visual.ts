import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
  seedTestCondition,
  openRoute,
} from '@/src/features/testing/visualTest';

test.describe('Add Consultation View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('Consultation View - Add New Form', async ({ page }, testInfo) => {
    // Reasons for visit are only offered when a condition exists.
    await seedTestCondition(page, { title: 'Scalp condition' });
    await openRoute(page, '/consultation/add');
    await page.getByTestId('consultation-title-input').waitFor();

    await takeSnapshot(page, 'Consultation View - Add New Form', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-diagnosis').click();
    await waitForMenuToggle(page, 'add-option-button', false);
    await page.getByTestId('diagnosis-0-title-input').fill('Scalp irritation');
    // Optional diagnosis fields are added from the + next to its heading
    for (const [field, value] of [
      ['system', 'http://hl7.org/fhir/sid/icd-10'],
      ['code', 'L21'],
      ['display', 'Seborrhoeic dermatitis'],
    ]) {
      await page.getByTestId('diagnosis-0-add').click();
      await page.getByTestId(`diagnosis-option-${field}`).click();
      await page.getByTestId('diagnosis-options-menu').waitFor({
        state: 'detached',
      });
      await page.getByTestId(`diagnosis-0-${field}-input`).fill(value);
    }
    await takeSnapshot(page, 'Consultation View - Add Diagnosis', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-diagnosis').click();
    await waitForMenuToggle(page, 'add-option-button', false);
    await page.getByTestId('diagnosis-1-title-input').fill('Second diagnosis');
    await takeSnapshot(
      page,
      'Consultation View - Separate diagnosis items',
      testInfo
    );
    await seedTestCondition(page, {
      id: 'add-first',
      title: 'Seborrhoeic dermatitis',
    });
    await seedTestCondition(page, {
      id: 'add-second',
      title: 'Androgenic alopecia',
    });
    await openRoute(page, '/consultation/add?conditionId=add-first');
    await page
      .getByTestId('consultation-title-input')
      .fill('Dermatology review');
    await page.getByTestId('condition-search-input').fill('Androgenic');
    await page.getByTestId('condition-autocomplete-item-add-second').waitFor();
    await takeSnapshot(
      page,
      'Consultation View - Conditions search',
      testInfo,
      {
        keepFocus: true,
      }
    );
    await page.getByTestId('condition-autocomplete-item-add-second').click();
    await page.getByTestId('selected-condition-add-second').waitFor();
    await takeSnapshot(
      page,
      'Consultation View - Multiple diagnosis form',
      testInfo
    );
  });
});
