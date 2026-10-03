import { test, expect } from '@playwright/test';
import { clearAppStorage } from '../testing/testStorage';

test.describe('Edit Condition Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await page.reload();
  });

  test('should allow editing an existing Condition', async ({ page }) => {
    // 1. Create a condition
    await page.goto('/condition/add');
    await page
      .getByTestId('condition-title-input')
      .fill('Right Shoulder Strain');
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Right Shoulder Strain')).toBeVisible();

    // 2. Click edit button
    const editBtn = page.locator('[data-testid^="edit-condition-button-"]');
    await editBtn.click();
    await expect(page).toHaveURL(/.*condition\/.*\/edit/);
    await expect(page.getByText('Edit Condition')).toBeVisible();

    // 3. Verify populated title
    const titleInput = page.getByTestId('condition-title-input');
    await expect(titleInput).toHaveValue('Right Shoulder Strain');

    // Update title
    await titleInput.fill('Right Shoulder Strain - Resolved');
    await page.getByTestId('save-button').click();

    // 4. Verify home view reflects updated title
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(
      page.getByText('Right Shoulder Strain - Resolved')
    ).toBeVisible();
  });

  test('should allow deleting a Condition with confirmation modal and cancel option', async ({
    page,
  }) => {
    // 1. Create a condition
    await page.goto('/condition/add');
    await page.getByTestId('condition-title-input').fill('Migraine Case');
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Migraine Case')).toBeVisible();

    // 2. Click delete button
    const deleteBtn = page.locator('[data-testid^="delete-condition-button-"]');
    await deleteBtn.click();

    // 3. Modal appears with Cancel and Delete
    const modal = page.getByTestId('delete-confirmation-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Delete Condition')).toBeVisible();

    // Cancel deletion
    const cancelBtn = page.getByTestId('delete-modal-cancel-button');
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByText('Migraine Case')).toBeVisible();

    // 4. Click delete again and verify 5-second countdown
    await deleteBtn.click();
    const confirmBtn = page.getByTestId('delete-modal-confirm-button');
    await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmBtn).toContainText('Delete (');

    // Wait until countdown reaches 0 and button becomes enabled with text "Delete"
    await expect(confirmBtn).toHaveText('Delete', { timeout: 7000 });
    await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
    await confirmBtn.click();

    // 5. Condition is removed, returns to empty state
    await expect(page.getByText('Migraine Case')).not.toBeVisible();
    await expect(page.getByText('Nothing to show yet')).toBeVisible();
  });
});
