import { test, expect } from '@playwright/test';
import { clearAppStorage, createPatientViaUI } from '../testing/testStorage';

test.describe('Add Condition Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
    await page.reload();
  });

  test('should allow creating a Condition with status, title, and optional fields via plus modal', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-condition').click();

    await expect(page).toHaveURL(/.*condition\/add/);
    await expect(page.getByText('New Condition')).toBeVisible();

    // Select status "Active"
    const statusSelect = page.getByTestId('status-picker-select');
    await statusSelect.selectOption('active');

    // Enter condition name
    const titleInput = page.getByTestId('condition-title-input');
    await titleInput.fill('Left Knee Pain');

    // Notes is initially hidden
    await expect(page.getByTestId('condition-notes-input')).not.toBeVisible();

    // Click plus button -> opens Add Options Modal
    const addOptionBtn = page.getByTestId('add-option-button');
    await expect(addOptionBtn).toBeVisible();
    await addOptionBtn.click();

    // Verify modal appears with "Add Notes" option
    const addNotesOption = page.getByTestId('menu-add-notes');
    await expect(addNotesOption).toBeVisible();
    await addNotesOption.click();

    // Enter notes
    const notesInput = page.getByTestId('condition-notes-input');
    await expect(notesInput).toBeVisible();
    await notesInput.fill('Mild swelling after jogging 5km.');

    // Save
    await page.getByTestId('save-button').click();

    // Verify redirected to Home and card appears
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Left Knee Pain')).toBeVisible();
    await expect(
      page.getByText('Mild swelling after jogging 5km.')
    ).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();

    // Edit and Delete buttons should exist
    const editBtn = page.locator('[data-testid^="edit-condition-button-"]');
    const deleteBtn = page.locator('[data-testid^="delete-condition-button-"]');
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();
  });
});
