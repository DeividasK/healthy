import { test, expect } from '@playwright/test';

test.describe('Edit Health Case Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('should allow editing an existing Health Case', async ({ page }) => {
    // 1. Create a case
    await page.goto('/health-case/add');
    await page.getByTestId('case-title-input').fill('Right Shoulder Strain');
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Right Shoulder Strain')).toBeVisible();

    // 2. Click edit button
    const editBtn = page.locator('[data-testid^="edit-case-button-"]');
    await editBtn.click();
    await expect(page).toHaveURL(/.*health-case\/.*\/edit/);
    await expect(page.getByText('Edit Health Case')).toBeVisible();

    // 3. Verify populated title
    const titleInput = page.getByTestId('case-title-input');
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

  test('should allow deleting a Health Case with confirmation modal and cancel option', async ({
    page,
  }) => {
    // 1. Create a case
    await page.goto('/health-case/add');
    await page.getByTestId('case-title-input').fill('Migraine Case');
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Migraine Case')).toBeVisible();

    // 2. Click delete button
    const deleteBtn = page.locator('[data-testid^="delete-case-button-"]');
    await deleteBtn.click();

    // 3. Modal appears with Cancel and Delete
    const modal = page.getByTestId('delete-confirmation-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Delete Health Case')).toBeVisible();

    // Cancel deletion
    const cancelBtn = page.getByTestId('delete-modal-cancel-button');
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByText('Migraine Case')).toBeVisible();

    // 4. Click delete again and confirm
    await deleteBtn.click();
    const confirmBtn = page.getByTestId('delete-modal-confirm-button');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 5. Case is removed, returns to empty state
    await expect(page.getByText('Migraine Case')).not.toBeVisible();
    await expect(page.getByText('Nothing to show yet')).toBeVisible();
  });
});
