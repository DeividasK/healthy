import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';

test.describe('Add Bundle - Visual Regression', () => {
  test('Form with treatments and times', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await seedTestResources(page, {
      treatments: [
        { id: 'visual-bundle-vit-d', title: 'Vitamin D 1000 IU' },
        { id: 'visual-bundle-omega', title: 'Omega-3 1g' },
      ],
    });
    await page.goto('/bundle/add?treatmentId=visual-bundle-vit-d');
    await page.getByTestId('bundle-form-title').waitFor();
    await page.getByTestId('bundle-title-input').fill('Before breakfast');
    await page.getByTestId('bundle-treatment-search-input').click();
    await page
      .getByTestId('bundle-treatment-autocomplete-item-visual-bundle-omega')
      .click();
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-bundle-times').click();
    await page
      .getByTestId('bundle-time-1-select')
      .selectOption({ label: 'At a specific time' });
    await page.locator('#bundle-time-1-input').fill('07:30');
    await page.getByTestId('bundle-time-1-add').click();
    await page.getByTestId('bundle-time-1-add-time').click();
    await page.getByTestId('bundle-time-2-select').selectOption('EVE');
    await takeSnapshot(page, 'Bundle - Add Form', testInfo);
  });
});
