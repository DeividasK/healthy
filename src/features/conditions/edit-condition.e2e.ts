import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
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
        const editBtn = page.getByTestId(/^edit-condition-button-/);
        await editBtn.click();
        await expect(page).toHaveURL(/.*condition\/.*\/edit/);
        await expect(page.getByText('Edit Condition')).toBeVisible();

        const titleInput = page.getByTestId('condition-title-input');
        await expect(titleInput).toHaveValue(DEFAULT_CONDITION_TITLE);

        await titleInput.fill('Updated Condition');
        await page.getByTestId('save-button').click();
      });

      await test.step('Verify home view reflects updated condition title', async () => {
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Updated Condition')).toBeVisible();
      });
    }
  );

  test(
    'should allow clicking into Condition View and deleting from Condition View',
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

      await test.step('Delete condition from Condition View', async () => {
        const deleteBtn = page.getByTestId('delete-condition-button');
        await deleteBtn.click();

        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByTestId('condition-title')).toBeVisible();

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
});
