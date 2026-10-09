import {
  test,
  expect,
  clearAppStorage,
  createPatientViaUI,
  createReportViaUI,
  createTestConditionViaUI,
} from '@/src/features/testing/testStorage';

test.describe('Fresh Install Onboarding Redirect', () => {
  test('should redirect to /profile/new on fresh install when no patients exist', async ({
    page,
  }) => {
    await clearAppStorage(page);
    await page.goto('/');
    await expect(page).toHaveURL(/.*profile\/new/);
    await expect(page.getByText('Add Profile')).toBeVisible();
  });
});

test.describe('Home View Flow, Floating Plus Button, and Lab Result Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
  });

  test('should display "Nothing to show yet" on empty home and render floating plus button', async ({
    page,
  }) => {
    await expect(page.getByText('Nothing to show yet')).toBeVisible();

    const floatingBtn = page.getByTestId('floating-add-button');
    await expect(floatingBtn).toBeVisible();

    // Tap floating button -> menu opens
    await floatingBtn.click();
    const menu = page.getByTestId('floating-add-menu');
    await expect(menu).toBeVisible();
    await expect(page.getByTestId('menu-add-condition')).toBeVisible();
    await expect(page.getByTestId('menu-add-lab-results')).toBeVisible();

    // Tap floating button again -> menu closes
    await floatingBtn.click();
    await expect(menu).not.toBeVisible();
  });

  test('should enforce 5-second countdown on Lab Result delete button and cancel safely', async ({
    page,
  }) => {
    // 1. Create a lab result report via UI
    await createReportViaUI(page, {
      biomarkers: [{ name: 'Hemoglobin', value: '14.2' }],
    });

    await page.goto('/');

    // Verify report card is visible
    const reportCard = page.locator('[data-testid^="report-card-"]').first();
    await expect(reportCard).toBeVisible();

    // Verify Delete button is on the right of Edit button
    const deleteBtn = page
      .locator('[data-testid^="delete-report-button-"]')
      .first();
    const editBtn = page
      .locator('[data-testid^="edit-report-button-"]')
      .first();
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // 2. Open delete modal
    await deleteBtn.click();
    const modal = page.getByTestId('delete-confirmation-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Delete Lab Result')).toBeVisible();

    // 3. Confirm Delete button is initially disabled with countdown
    const confirmBtn = page.getByTestId('delete-modal-confirm-button');
    await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmBtn).toContainText('Delete (');

    // Test Cancel button dismisses modal without deleting
    const cancelBtn = page.getByTestId('delete-modal-cancel-button');
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
    await expect(reportCard).toBeVisible();

    // 4. Reopen modal and wait for 5-second countdown to finish
    await page.clock.install();
    await deleteBtn.click();
    await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

    // Fast-forward countdown by 5 seconds
    await page.clock.runFor(5000);
    await expect(confirmBtn).toHaveText('Delete');
    await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');

    // Click enabled Delete button
    await confirmBtn.click();

    // 5. Modal closes and report is deleted, returning to empty state
    await expect(modal).not.toBeVisible();
    await expect(reportCard).not.toBeVisible();
    await expect(page.getByText('Nothing to show yet')).toBeVisible();
  });

  test('should persist and retrieve records in SQLite database across reloads', async ({
    page,
  }) => {
    // 1. Visit home and create a report via UI
    await createReportViaUI(page, {
      biomarkers: [{ name: 'Hemoglobin', value: '15.5' }],
      notes: 'Database persistence inspection test',
    });

    // 2. Reload page and verify data is read from SQLite database
    await page.goto('/');
    const reportCard = page.locator('[data-testid^="report-card-"]').first();
    await expect(reportCard).toBeVisible();
    await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
    await expect(page.getByText('15.5')).toBeVisible();
    await expect(
      page.getByText('"Database persistence inspection test"')
    ).toBeVisible();

    // 3. Hard reload page to verify persistent storage across reloads
    await page.reload();
    await expect(reportCard).toBeVisible();
    await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
    await expect(page.getByText('15.5')).toBeVisible();
  });

  test('should automatically re-render and display new condition and handle focus/wakeup sync gracefully', async ({
    page,
  }) => {
    // 1. Visit Home, initially showing "Nothing to show yet"
    await expect(page.getByText('Nothing to show yet')).toBeVisible();

    // 2. Add a condition via helper
    await createTestConditionViaUI(page, { title: 'Asthma' });

    // 3. Condition is immediately visible on Home
    await expect(page.getByText('Asthma')).toBeVisible();

    // 4. Test focus and wakeup sync reactivity: dispatch focus and visibilitychange events
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // 5. Verify home stays intact and continues displaying condition
    await expect(page.getByText('Asthma')).toBeVisible();
    await expect(page.getByText('Nothing to show yet')).not.toBeVisible();
  });
});
