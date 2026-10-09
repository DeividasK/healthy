import {
  test,
  expect,
  clearAppStorage,
  createPatientViaUI,
  createTestConditionViaUI,
  DEFAULT_CONDITION_TITLE,
} from '@/src/features/testing/testStorage';

test.describe('Edit Condition Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
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
    'should allow deleting a Condition with confirmation modal and cancel option',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create a condition', async () => {
        await createTestConditionViaUI(page);
      });

      const deleteBtn = page.getByTestId(/^delete-condition-button-/);

      await test.step('Open delete modal and test cancellation', async () => {
        await deleteBtn.click();

        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();
        await expect(page.getByText('Delete Condition')).toBeVisible();

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByText(DEFAULT_CONDITION_TITLE)).toBeVisible();
      });

      await test.step('Re-open modal, verify 5-second countdown, and confirm deletion', async () => {
        await page.clock.install();
        await deleteBtn.click();
        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
        await expect(confirmBtn).toContainText('Delete (');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
        await confirmBtn.click();
      });

      await test.step('Verify condition removed and empty state shown', async () => {
        await expect(page.getByText(DEFAULT_CONDITION_TITLE)).not.toBeVisible();
        await expect(page.getByText('Nothing to show yet')).toBeVisible();
      });
    }
  );
});
