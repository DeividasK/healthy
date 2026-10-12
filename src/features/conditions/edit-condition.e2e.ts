import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  createTestConditionViaUI,
  DEFAULT_CONDITION_TITLE,
} from '@/src/features/testing/testStorage';

test.describe('Edit Condition Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test(
    'should allow editing an existing Condition',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Create an initial condition', async () => {
        await createTestConditionViaUI(page);
      });

      await test.step('Open edit condition screen and verify initial title', async () => {
        await page.getByTestId(/^condition-card-/).click();
        await page.getByTestId('edit-condition-button').click();
        await expect(page).toHaveURL(/.*condition\/.*\/edit/);
        await expect(page.getByText('Edit Condition')).toBeVisible();

        const titleInput = page.getByTestId('condition-title-input');
        await expect(titleInput).toHaveValue(DEFAULT_CONDITION_TITLE);

        await titleInput.fill('Updated Condition');
        await page.getByTestId('save-button').click();
      });

      await test.step('Verify Condition view reflects the updated title', async () => {
        await expect(page).toHaveURL(/.*condition\/.*$/);
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Updated Condition'
        );
      });
    }
  );

  test(
    'should open Condition View and delete from edit mode',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create a condition', async () => {
        await createTestConditionViaUI(page);
      });

      await test.step('Click condition card to open Condition View', async () => {
        const condCard = page.getByTestId(/^condition-card-/);
        await condCard.click();
        await expect(page).toHaveURL(/.*condition\/[a-zA-Z0-9_-]+$/);
        await expect(page.getByTestId('condition-title')).toHaveText(
          DEFAULT_CONDITION_TITLE
        );
      });

      await test.step('Delete condition from edit mode', async () => {
        await expect(page.getByTestId('delete-condition-button')).toHaveCount(
          0
        );
        await page.getByTestId('edit-condition-button').click();
        const deleteBtn = page.getByTestId('delete-condition-button');
        await deleteBtn.click();

        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByTestId('condition-title-input')).toHaveValue(
          DEFAULT_CONDITION_TITLE
        );

        await page.clock.install();
        await deleteBtn.click();
        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
        await confirmBtn.click();
      });

      await test.step('Verify returned to Home and condition removed', async () => {
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText(DEFAULT_CONDITION_TITLE)).not.toBeVisible();
        await expect(page.getByText('Nothing to show yet')).toBeVisible();
      });
    }
  );
  test('opens the one-item add menu and creates a linked Consultation', async ({
    page,
  }) => {
    const initial = await seedTestCondition(page, {
      title: 'Initial Condition',
    });
    await page.goto(`/condition/${initial.id}`);
    const view = page.getByTestId('condition-view');
    const addButton = page.getByTestId('condition-add-button');
    const menu = page.getByTestId('condition-add-menu');
    const viewportWidth = page.viewportSize()!.width;
    await expect(view.getByTestId('condition-title')).toBeVisible();
    const conditionHeading = await view
      .getByTestId('condition-title')
      .boundingBox();
    expect(conditionHeading!.x).toBeCloseTo(20);
    expect(conditionHeading!.width).toBeCloseTo(viewportWidth - 40);

    await addButton.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button')).toHaveCount(1);
    await expect(
      menu.getByRole('button', { name: 'Add Consultation', exact: true })
    ).toBeVisible();
    await expect(addButton).toHaveAttribute('aria-expanded', 'true');
    await expect(addButton).toHaveAccessibleName('Close add menu');
    await expect(addButton).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.getByTestId('condition-add-button-icon')).not.toHaveCSS(
      'transform',
      'none'
    );

    await page.evaluate(() => {
      const state = {
        samples: [] as {
          opacity: number;
          y: number;
          backdropOpacity: number;
        }[],
        frame: 0,
      };
      (window as any).__menuMotion = state;
      const sample = () => {
        const menu = document.querySelector(
          '[data-testid="condition-add-menu"]'
        );
        const backdrop = document.querySelector(
          '[data-testid="condition-add-menu-backdrop"]'
        )?.parentElement;
        if (menu && backdrop)
          state.samples.push({
            opacity: Number(getComputedStyle(menu).opacity),
            y: menu.getBoundingClientRect().y,
            backdropOpacity: Number(getComputedStyle(backdrop).opacity),
          });
        state.frame = requestAnimationFrame(sample);
      };
      sample();
    });
    await addButton.click();
    await expect(menu).not.toBeVisible();
    const menuMotion = await page.evaluate(() => {
      const state = (window as any).__menuMotion;
      cancelAnimationFrame(state.frame);
      return state.samples as {
        opacity: number;
        y: number;
        backdropOpacity: number;
      }[];
    });
    expect(
      menuMotion.some(
        (sample) =>
          sample.opacity > 0 && sample.opacity < 1 && sample.y > menuMotion[0].y
      )
    ).toBe(true);
    expect(
      menuMotion.some(
        (sample) => sample.backdropOpacity > 0 && sample.backdropOpacity < 1
      )
    ).toBe(true);
    await expect(addButton).toHaveAttribute('aria-expanded', 'false');
    await expect(addButton).toHaveAccessibleName('Add consultation');
    await addButton.click();
    await page
      .getByTestId('condition-add-menu-backdrop')
      .click({ position: { x: 10, y: 10 } });
    await expect(menu).not.toBeVisible();

    await addButton.click();
    await menu
      .getByRole('button', { name: 'Add Consultation', exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation/add\\?conditionId=${initial.id}$`)
    );
    await expect(page.getByTestId('condition-picker-select')).toHaveValue(
      initial.id
    );
    await page
      .getByTestId('consultation-title-input')
      .fill('Linked Consultation');
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(new RegExp(`.*condition/${initial.id}$`));
    await expect(view.getByTestId('condition-title')).toHaveText(
      'Initial Condition'
    );
    await expect(
      view
        .getByTestId('condition-consultations-section')
        .getByText('Linked Consultation', { exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      view
        .getByTestId('condition-consultations-section')
        .getByText('Linked Consultation', { exact: true })
    ).toBeVisible();

    const consultationRow = view.getByTestId(/^condition-consultation-item-/);
    expect((await consultationRow.boundingBox())!.width).toBeCloseTo(
      viewportWidth
    );
    await consultationRow.click();
    const consultationView = page.getByTestId('consultation-view');
    await expect(consultationView.getByTestId('consultation-title')).toHaveText(
      'Linked Consultation'
    );
    const consultationHeading = await consultationView
      .getByTestId('consultation-title')
      .boundingBox();
    expect(consultationHeading!.x).toBeCloseTo(20);
    expect(consultationHeading!.width).toBeCloseTo(viewportWidth - 40);
    await page.getByTestId('back-button').click();

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Linked Consultation')).not.toBeVisible();
  });
});
