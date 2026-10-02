import { test, expect } from '@playwright/test';
import { clearAppStorage } from '../testing/testStorage';

test.describe('Add Health Case Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await page.reload();
  });

  test('should allow creating a Health Case with status, title, and optional description via plus modal', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-health-case').click();

    await expect(page).toHaveURL(/.*health-case\/add/);
    await expect(page.getByText('New Health Case')).toBeVisible();

    // Select status "On Hold"
    const statusSelect = page.getByTestId('status-picker-select');
    await statusSelect.selectOption('onhold');

    // Enter case title
    const titleInput = page.getByTestId('case-title-input');
    await titleInput.fill('Left Knee Pain');

    // Description is initially hidden
    await expect(page.getByTestId('case-description-input')).not.toBeVisible();

    // Click plus button -> opens Add Options Modal
    const addDescBtn = page.getByTestId('add-description-button');
    await expect(addDescBtn).toBeVisible();
    await addDescBtn.click();

    // Verify modal appears with "Add Description" option
    const addDescOption = page.getByTestId('menu-add-description');
    await expect(addDescOption).toBeVisible();
    await addDescOption.click();

    // Enter description
    const descInput = page.getByTestId('case-description-input');
    await expect(descInput).toBeVisible();
    await descInput.fill('Mild swelling after jogging 5km.');

    // Save
    await page.getByTestId('save-button').click();

    // Verify redirected to Home and card appears
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Left Knee Pain')).toBeVisible();
    await expect(
      page.getByText('Mild swelling after jogging 5km.')
    ).toBeVisible();
    await expect(page.getByText('On Hold')).toBeVisible();

    // Edit and Delete buttons should exist
    const editBtn = page.locator('[data-testid^="edit-case-button-"]');
    const deleteBtn = page.locator('[data-testid^="delete-case-button-"]');
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();
  });
});
