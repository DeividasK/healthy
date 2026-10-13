import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
} from '@/src/features/testing/visualTest';

test.describe('Add Consultation View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('Consultation View - Add New Form', async ({ page }, testInfo) => {
    await page.goto('/consultation/add');
    await page.getByTestId('consultation-title-input').waitFor();

    await takeSnapshot(page, 'Consultation View - Add New Form', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-condition').click();
    await page.getByTestId('condition-search-input').waitFor();
    await takeSnapshot(
      page,
      'Consultation View - Empty conditions section',
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
    await page.goto('/consultation/add?conditionId=add-first');
    await page
      .getByTestId('consultation-title-input')
      .fill('Dermatology review');
    await page.getByTestId('condition-search-input').fill('Androgenic');
    await page.getByTestId('condition-autocomplete-item-add-second').waitFor();
    await takeSnapshot(page, 'Consultation View - Conditions search', testInfo);
    await page.getByTestId('condition-autocomplete-item-add-second').click();
    await page.getByTestId('selected-condition-add-second').waitFor();
    await takeSnapshot(
      page,
      'Consultation View - Multiple diagnosis form',
      testInfo
    );
  });
});
