import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
} from '@/src/features/testing/visualTest';

test.describe('Add Consultation View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('Consultation View - Add New Form', async ({ page }, testInfo) => {
    await seedTestCondition(page, {
      id: 'add-first',
      title: 'Seborrhoeic dermatitis',
    });
    await seedTestCondition(page, {
      id: 'add-second',
      title: 'Androgenic alopecia',
    });
    await seedTestCondition(page, { id: 'add-third', title: 'Atopic eczema' });
    await page.goto('/consultation/add?conditionId=add-first');
    await page
      .getByTestId('consultation-title-input')
      .fill('Dermatology review');
    // Two selected conditions above the search, with its suggestions open.
    await page.getByTestId('condition-search-input').fill('Androgenic');
    await page.getByTestId('condition-autocomplete-item-add-second').click();
    await page.getByTestId('selected-condition-add-second').waitFor();
    await page.getByTestId('condition-search-input').fill('Atopic');
    await page.getByTestId('condition-autocomplete-item-add-third').waitFor();
    await takeSnapshot(
      page,
      'Consultation View - Conditions search',
      testInfo,
      {
        keepFocus: true,
      }
    );
  });
});
