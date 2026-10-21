import {
  test,
  expect,
  seedTestPatient,
  seedTestConsultation,
  checkA11y,
  evaluateBridge,
  openRoute,
  reopenRoute,
} from '@/src/features/testing/testStorage';

test.describe('Add Condition Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('field labels are labels for their controls and mark required ones', async ({
    page,
  }) => {
    await openRoute(page, '/condition/add');
    // A required text input and a required native select
    for (const id of ['condition-title-input', 'status-picker-select']) {
      await expect(page.locator(`label[for="${id}"]`)).toHaveText(/ \*$/);
      await expect(page.getByTestId(id)).toHaveAttribute(
        'aria-required',
        'true'
      );
    }
    // Clicking a label focuses its control
    await page.locator('label[for="condition-title-input"]').click();
    await expect(page.getByTestId('condition-title-input')).toBeFocused();
    // An optional field has a bound label without the required mark
    const category = page.getByTestId('condition-category-input');
    await expect(
      page.locator('label[for="condition-category-input"]')
    ).toHaveText('Category');
    await expect(category).not.toHaveAttribute('aria-required', 'true');
  });

  test(
    'adds a condition with optional fields, then views, edits and deletes it',
    { tag: ['@smoke', '@critical'] },
    async ({ page, consoleMonitor }) => {
      await test.step('Navigate to Add Condition screen and audit a11y', async () => {
        // An empty Home starts a first record from its starter rows.
        await page.getByTestId('start-condition').click();

        await expect(page).toHaveURL(/.*condition\/add/);
        await expect(page.getByText('New Condition')).toBeVisible();
        // Audit once Home's closing menu has faded out completely
        await expect(page.getByTestId('floating-add-menu')).toHaveCount(0);
        await checkA11y(page);
        const titleBounds = (await page
          .getByTestId('condition-title-input')
          .boundingBox())!;
        for (const id of [
          'verification-picker-button',
          'condition-category-input',
        ]) {
          const field = page.getByTestId(id);
          await expect(field).toHaveRole('combobox');
          const bounds = (await field.boundingBox())!;
          const caret = (await page.getByTestId(`${id}-caret`).boundingBox())!;
          expect(bounds.x).toBeCloseTo(titleBounds.x);
          expect(bounds.width).toBeCloseTo(titleBounds.width);
          expect(caret.y + caret.height / 2).toBeCloseTo(
            bounds.y + bounds.height / 2
          );
          expect(bounds.x + bounds.width - caret.x - caret.width).toBeCloseTo(
            14
          );
        }
      });

      await test.step('Select status and enter condition title', async () => {
        const statusSelect = page.getByTestId('status-picker-select');
        await statusSelect.selectOption('active');
        await page
          .getByTestId('verification-picker-button')
          .selectOption('confirmed');

        const titleInput = page.getByTestId('condition-title-input');
        await titleInput.fill('Left Knee Pain');

        await expect(
          page.getByTestId('condition-notes-input')
        ).not.toBeVisible();
      });

      await test.step('Add optional notes via plus modal', async () => {
        const addOptionBtn = page.getByTestId('add-option-button');
        await expect(addOptionBtn).toBeVisible();
        await addOptionBtn.click();

        const addNotesOption = page.getByTestId('menu-add-notes');
        await expect(addNotesOption).toBeVisible();
        await addNotesOption.click();

        const notesInput = page.getByTestId('condition-notes-input');
        await expect(notesInput).toBeVisible();
        await notesInput.fill('Mild swelling after jogging 5km.');
      });

      await test.step('Save condition and verify card on Home', async () => {
        await page.getByTestId('save-button').click();

        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Left Knee Pain')).toBeVisible();
        // Home rows show the meta line; notes stay on the condition view.
        await expect(page.getByText('Active')).toBeVisible();

        const conditionCard = page.getByTestId(/^condition-card-/);
        await expect(conditionCard).toBeVisible();
        await expect(page.getByTestId(/^edit-condition-button-/)).toHaveCount(
          0
        );
        await expect(page.getByTestId(/^delete-condition-button-/)).toHaveCount(
          0
        );
      });

      let conditionId = '';
      await test.step('View it with its timeline, then edit it', async () => {
        await page.getByRole('button', { name: /^View condition:/ }).click();
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Left Knee Pain'
        );
        conditionId = new URL(page.url()).pathname.split('/').pop()!;
        await seedTestConsultation(page, {
          conditionIds: [conditionId],
          title: 'Knee Arthroscopy Review',
        });
        await reopenRoute(page);
        // The timeline and its + belong to the view, not the edit form.
        await expect(page.getByTestId('condition-timeline')).toBeVisible();
        await expect(page.getByTestId('condition-add-button')).toBeVisible();
        await page.getByTestId('edit-condition-button').click();
        await expect(page).toHaveURL(/.*condition\/.*\/edit/);
        await expect(page.getByText('Edit Condition')).toBeVisible();
        await expect(page.getByTestId('condition-timeline')).not.toBeVisible();
        await expect(
          page.getByTestId('condition-add-button')
        ).not.toBeVisible();
        // Edit forms do not delete; the view page's island does.
        await expect(page.getByTestId('delete-condition-button')).toHaveCount(
          0
        );

        const titleInput = page.getByTestId('condition-title-input');
        await expect(titleInput).toHaveValue('Left Knee Pain');
        await titleInput.fill('Updated Condition');
        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(new RegExp(`condition/${conditionId}$`));
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Updated Condition'
        );
        await expect(page.getByTestId('condition-timeline')).toBeVisible();
      });

      await test.step('Delete it after a countdown, explaining a failure and allowing retry', async () => {
        const deleteButton = page.getByTestId('delete-condition-button');
        const modal = page.getByTestId('delete-confirmation-modal');
        await deleteButton.click();
        await expect(modal).toBeVisible();
        await page.getByTestId('delete-modal-cancel-button').click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Updated Condition'
        );

        await evaluateBridge(
          page,
          (b, id) =>
            b.executeSql(
              `CREATE TEMP TRIGGER fail_condition_delete BEFORE DELETE ON conditions
               WHEN OLD.id = '${id}'
               BEGIN SELECT RAISE(ABORT, 'Simulated deletion failure'); END;`
            ),
          conditionId
        );
        consoleMonitor.ignore('Failed to delete resource:');
        await page.clock.install();
        await deleteButton.click();
        const confirm = page.getByTestId('delete-modal-confirm-button');
        // Confirming unlocks only after a 5 second countdown.
        await expect(confirm).toHaveAttribute('aria-disabled', 'true');
        await expect(confirm).toContainText('Delete (');
        await page.clock.runFor(5000);
        await expect(confirm).toHaveText('Delete');
        await expect(confirm).toBeEnabled();
        const dialogPromise = page.waitForEvent('dialog');
        const clickPromise = confirm.click();
        const dialog = await dialogPromise;
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toBe(
          'Error\nFailed to delete. Please try again.'
        );
        await dialog.accept();
        await clickPromise;
        await expect(modal).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`condition/${conditionId}$`));

        await evaluateBridge(page, (b) =>
          b.executeSql('DROP TRIGGER fail_condition_delete;')
        );
        await confirm.click();
        await expect(page).toHaveURL(/\/$/);
        // The condition is gone for good; its consultation stays.
        const conditionRows = page.getByTestId(/^condition-card-/);
        await expect(page.getByText('Knee Arthroscopy Review')).toBeVisible();
        await expect(conditionRows).toHaveCount(0);
        await page.reload();
        await expect(page.getByText('Knee Arthroscopy Review')).toBeVisible();
        await expect(conditionRows).toHaveCount(0);
      });
    }
  );
});

test.describe('New condition form keyboard support', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('Escape asks before discarding entered data, defaulting to No', async ({
    page,
  }) => {
    await page.getByTestId('start-condition').click();
    await page.getByTestId('condition-title-input').fill('Unsaved condition');

    await page.keyboard.press('Escape');
    const modal = page.getByTestId('discard-changes-modal');
    await expect(modal.getByText('Are you sure?')).toBeVisible();
    await expect(
      modal.getByText("You'll lose the data you entered.")
    ).toBeVisible();
    const no = modal.getByRole('button', { name: 'No' });
    const yes = modal.getByRole('button', { name: 'Yes' });
    await expect(no).toBeFocused();
    // Cmd/Ctrl+Enter does not save while the prompt is open
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/condition\/add/);

    // Enter on the focused No keeps the form and its data
    await page.keyboard.press('Enter');
    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(/condition\/add/);
    await expect(page.getByTestId('condition-title-input')).toHaveValue(
      'Unsaved condition'
    );

    // Escape also dismisses the prompt
    await page.keyboard.press('Escape');
    await expect(no).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(/condition\/add/);

    // Tab to Yes and Enter discards the form
    await page.keyboard.press('Escape');
    await expect(no).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(yes).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Unsaved condition')).toHaveCount(0);
  });
});

test.describe('Condition form island', () => {
  // Checks the + rotating into a close icon, so it runs with full motion.
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('centers the add menu on its + and turns the + into a close icon', async ({
    page,
  }) => {
    await openRoute(page, '/condition/add');
    const add = page.getByTestId('add-option-button');
    await add.click();
    const menu = page.getByTestId('form-add-menu');
    await expect(menu).toBeVisible();
    await expect(add).toHaveAttribute('aria-label', 'Close add menu');
    await expect
      .poll(() =>
        page
          .getByTestId('add-option-button-icon')
          .evaluate((element) => getComputedStyle(element).transform)
      )
      .not.toBe('none');
    await expect
      .poll(async () => {
        const menuBox = (await menu.boundingBox())!;
        const addBox = (await add.boundingBox())!;
        return Math.abs(
          menuBox.x + menuBox.width / 2 - (addBox.x + addBox.width / 2)
        );
      })
      .toBeLessThan(1);
  });
});
