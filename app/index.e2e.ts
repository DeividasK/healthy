import { test, expect } from '@playwright/test';

test.describe('Home View Flow, Floating Plus Button, and Lab Result Deletion', () => {
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
