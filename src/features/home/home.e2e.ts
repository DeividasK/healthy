import {
  test,
  expect,
  clearAppStorage,
  createPatientViaUI,
  createReportViaUI,
  createTestConditionViaUI,
} from '@/src/features/testing/testStorage';

test.describe('Fresh Install Onboarding Redirect', () => {
  test(
    'should redirect to /profile/new on fresh install when no patients exist',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Clear storage and navigate to root', async () => {
        await clearAppStorage(page);
        await page.goto('/');
      });

      await test.step('Verify redirected to /profile/new', async () => {
        await expect(page).toHaveURL(/.*profile\/new/);
        await expect(page.getByText('Add Profile')).toBeVisible();
      });
    }
  );
});

test.describe('Home View Flow, Floating Plus Button, and Lab Result Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
  });

  test(
    'should display "Nothing to show yet" on empty home and render floating plus button',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Verify empty state on Home', async () => {
        await expect(page.getByText('Nothing to show yet')).toBeVisible();
      });

      await test.step('Open floating menu', async () => {
        const floatingBtn = page.getByTestId('floating-add-button');
        await expect(floatingBtn).toBeVisible();
        await floatingBtn.click();

        const menu = page.getByTestId('floating-add-menu');
        await expect(menu).toBeVisible();
        await expect(page.getByTestId('menu-add-condition')).toBeVisible();
        await expect(page.getByTestId('menu-add-lab-results')).toBeVisible();

        // Tap floating button again -> menu closes
        await floatingBtn.click();
        await expect(menu).not.toBeVisible();
      });
    }
  );

  test(
    'should enforce 5-second countdown on Lab Result delete button and cancel safely',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create a lab report via UI and navigate to Home', async () => {
        await createReportViaUI(page, {
          biomarkers: [{ name: 'Hemoglobin', value: '14.2' }],
        });
        await page.goto('/');

        const reportCard = page.getByTestId(/^report-card-/).first();
        await expect(reportCard).toBeVisible();

        const deleteBtn = page.getByTestId(/^delete-report-button-/).first();
        const editBtn = page.getByTestId(/^edit-report-button-/).first();
        await expect(editBtn).toBeVisible();
        await expect(deleteBtn).toBeVisible();
      });

      const reportCard = page.getByTestId(/^report-card-/).first();
      const deleteBtn = page.getByTestId(/^delete-report-button-/).first();

      await test.step('Open delete modal and test cancellation', async () => {
        await deleteBtn.click();
        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();
        await expect(page.getByText('Delete Lab Result')).toBeVisible();

        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
        await expect(confirmBtn).toContainText('Delete (');

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(reportCard).toBeVisible();
      });

      await test.step('Re-open modal, verify 5-second countdown, and confirm deletion', async () => {
        await page.clock.install();
        await deleteBtn.click();
        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');

        await confirmBtn.click();
        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).not.toBeVisible();
        await expect(reportCard).not.toBeVisible();
        await expect(page.getByText('Nothing to show yet')).toBeVisible();
      });
    }
  );

  test(
    'should persist and retrieve records in SQLite database across reloads',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create report and verify on Home', async () => {
        await createReportViaUI(page, {
          biomarkers: [{ name: 'Hemoglobin', value: '15.5' }],
          notes: 'Database persistence inspection test',
        });

        await page.goto('/');
        const reportCard = page.getByTestId(/^report-card-/).first();
        await expect(reportCard).toBeVisible();
        await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
        await expect(page.getByText('15.5')).toBeVisible();
        await expect(
          page.getByText('"Database persistence inspection test"')
        ).toBeVisible();
      });

      await test.step('Hard reload and verify data persists from SQLite', async () => {
        await page.reload();
        const reportCard = page.getByTestId(/^report-card-/).first();
        await expect(reportCard).toBeVisible();
        await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
        await expect(page.getByText('15.5')).toBeVisible();
      });
    }
  );

  test('should automatically re-render and display new condition and handle focus/wakeup sync gracefully', async ({
    page,
  }) => {
    await test.step('Verify initial empty state', async () => {
      await expect(page.getByText('Nothing to show yet')).toBeVisible();
    });

    await test.step('Add a condition and verify immediate render', async () => {
      await createTestConditionViaUI(page, { title: 'Asthma' });
      await expect(page.getByText('Asthma')).toBeVisible();
    });

    await test.step('Simulate window focus and visibility change events', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await expect(page.getByText('Asthma')).toBeVisible();
      await expect(page.getByText('Nothing to show yet')).not.toBeVisible();
    });
  });
});
