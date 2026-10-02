import { test, expect } from '@playwright/test';

test.describe('Health Cases, Deletions and Floating Action Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('should display "Nothing to show yet" on empty home and render floating plus button', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Nothing to show yet')).toBeVisible();

    const floatingBtn = page.getByTestId('floating-add-button');
    await expect(floatingBtn).toBeVisible();

    // Tap floating button -> menu opens
    await floatingBtn.click();
    const menu = page.getByTestId('floating-add-menu');
    await expect(menu).toBeVisible();
    await expect(page.getByTestId('menu-add-health-case')).toBeVisible();
    await expect(page.getByTestId('menu-add-lab-results')).toBeVisible();

    // Tap floating button again -> menu closes
    await floatingBtn.click();
    await expect(menu).not.toBeVisible();
  });

  test('should allow creating a Health Case with status, title, and optional description', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-health-case').click();

    await expect(page).toHaveURL(/.*health-case\/add/);
    await expect(page.getByText('New Health Case')).toBeVisible();

    // Select status "On Hold"
    const statusSelect = page.getByTestId('status-picker-select');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('onhold');
    }

    // Enter case title
    const titleInput = page.getByTestId('case-title-input');
    await titleInput.fill('Left Knee Pain');

    // Description is initially hidden
    await expect(page.getByTestId('case-description-input')).not.toBeVisible();

    // Click plus button to add description
    const addDescBtn = page.getByTestId('add-description-button');
    await expect(addDescBtn).toBeVisible();
    await addDescBtn.click();

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

  test('should enforce 5-second countdown on Lab Result delete button and cancel safely', async ({
    page,
  }) => {
    // 1. Seed a lab result report in localStorage
    await page.goto('/');
    await page.evaluate(() => {
      const now = '2026-10-02T10:00:00.000Z';
      const report = {
        resourceType: 'DiagnosticReport',
        id: 'rep-test-del-1',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '58410-2' }],
          text: 'CBC',
        },
        effectiveDateTime: '2026-10-02',
      };
      const obs = [
        {
          resourceType: 'Observation',
          id: 'obs-test-del-1',
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '718-7',
                display: 'Hemoglobin',
              },
            ],
          },
          valueQuantity: { value: 14.2, unit: 'g/dL', code: 'g/dL' },
        },
      ];

      localStorage.setItem(
        '@healthy_diagnostic_reports_v1',
        JSON.stringify({
          'rep-test-del-1': {
            id: 'rep-test-del-1',
            effective_date: '2026-10-02',
            status: 'final',
            notes: null,
            fhir_json: JSON.stringify(report),
            created_at: now,
            updated_at: now,
          },
        })
      );
      localStorage.setItem(
        '@healthy_observations_v1',
        JSON.stringify({
          'rep-test-del-1': [
            {
              id: 'obs-test-del-1',
              report_id: 'rep-test-del-1',
              loinc_code: '718-7',
              name: 'Hemoglobin',
              value: 14.2,
              unit: 'g/dL',
              fhir_json: JSON.stringify(obs[0]),
              created_at: now,
            },
          ],
        })
      );
    });

    await page.reload();

    // Verify report card is visible
    const reportCard = page.getByTestId('report-card-rep-test-del-1');
    await expect(reportCard).toBeVisible();

    // Verify Delete button is on the right of Edit button
    const deleteBtn = page.getByTestId('delete-report-button-rep-test-del-1');
    const editBtn = page.getByTestId('edit-report-button-rep-test-del-1');
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
    await deleteBtn.click();
    await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

    // Wait until countdown reaches 0 and button becomes enabled with text "Delete"
    await expect(confirmBtn).toHaveText('Delete', { timeout: 7000 });
    await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');

    // Click enabled Delete button
    await confirmBtn.click();

    // 5. Modal closes and report is deleted, returning to empty state
    await expect(modal).not.toBeVisible();
    await expect(reportCard).not.toBeVisible();
    await expect(page.getByText('Nothing to show yet')).toBeVisible();
  });
});
