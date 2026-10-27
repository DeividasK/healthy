import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
  seedTestResources,
  seedTestBundle,
} from '@/src/features/testing/visualTest';

test.describe('Add Treatment - Visual Regression', () => {
  test('Empty form and optional fields menu', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await page.goto('/treatment/add');
    await page.getByTestId('treatment-form-title').waitFor();
    await takeSnapshot(page, 'Treatment - Add Form Empty', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor();
    await waitForMenuToggle(page, 'add-option-button', true);
    await takeSnapshot(page, 'Treatment - Optional Fields Menu', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor({ state: 'hidden' });
    await waitForMenuToggle(page, 'add-option-button', false);
    await page.getByTestId('treatment-title-input').focus();
    await page.keyboard.press('Tab');
    await takeSnapshot(page, 'Treatment - Select Keyboard Focus', testInfo, {
      keepFocus: true,
    });

    // A populated two-phase regimen
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-treatment-regimen').click();
    await page.getByTestId('form-add-menu').waitFor({ state: 'hidden' });
    const field = (id: string) => page.getByTestId(`treatment-regimen-${id}`);
    const addFrom = async (button: string, option: string) => {
      await field(`${button}-add`).click();
      await field(`option-${option}`).click();
      await page.getByTestId('regimen-options-menu').waitFor({
        state: 'hidden',
      });
    };
    await field('p1-d1-amount-input').fill('2');
    await field('p1-d1-frequency-input').fill('1');
    await addFrom('p1-d1', 'when');
    await field('p1-d1-when-select').selectOption('MORN');
    await addFrom('p1', 'dose');
    await field('p1-d2-amount-input').fill('1');
    await field('p1-d2-frequency-input').fill('1');
    await addFrom('p1-d2', 'when');
    await field('p1-d2-when-select').selectOption('EVE');
    await addFrom('p1', 'phase');
    await field('p2-d1-amount-input').fill('1');
    await field('p2-d1-frequency-input').fill('1');
    await addFrom('p2-d1', 'frequencyMax');
    await field('p2-d1-frequencyMax-input').fill('2');
    await addFrom('p2-d1', 'bounds');
    await field('p2-d1-boundsValue-input').fill('3');
    await field('p2-d1-add').click();
    await page.getByTestId('regimen-options-menu').waitFor();
    await takeSnapshot(page, 'Treatment - Regimen Options Menu', testInfo);
    // The menu card covers the overlay's centre.
    await page
      .getByTestId('regimen-options-overlay')
      .click({ position: { x: 5, y: 5 } });
    await page.getByTestId('regimen-options-menu').waitFor({ state: 'hidden' });
    await page.getByTestId('treatment-title-input').focus();
    await takeSnapshot(page, 'Treatment - Add Form Regimen', testInfo);
  });

  for (const [name, size] of [
    ['mobile', null],
    ['desktop', { width: 1280, height: 800 }],
  ] as const) {
    test(`Bundles field - ${name}`, async ({ page }, testInfo) => {
      if (size) await page.setViewportSize(size);
      await seedTestPatient(page);
      await seedTestResources(page, {
        treatments: [{ id: 'visual-vitamin-d', title: 'Vitamin D3 4000 IU' }],
      });
      for (const [id, title] of [
        ['visual-morning', 'Morning stack'],
        ['visual-evening', 'Evening stack'],
      ])
        await seedTestBundle(page, {
          id,
          title,
          times: [id === 'visual-morning' ? 'MORN' : 'EVE'],
          memberIds: ['visual-vitamin-d'],
        });
      await page.goto('/treatment/add');
      await page
        .getByTestId('treatment-title-input')
        .fill('Magnesium glycinate');
      await page.getByTestId('add-option-button').click();
      await page.getByTestId('menu-link-bundle').click();
      await page.getByTestId('form-add-menu').waitFor({ state: 'hidden' });
      await page.getByTestId('link-bundle-search-input').click();
      await page
        .getByTestId('link-bundle-autocomplete-item-visual-morning')
        .click();
      await page.getByTestId('link-selected-bundle-visual-morning').waitFor();
      await page.getByTestId('treatment-title-input').focus();
      await takeSnapshot(
        page,
        `Treatment - Add Form Bundles ${name}`,
        testInfo
      );
    });
  }
});
