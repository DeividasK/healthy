import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
} from '@/src/features/testing/testStorage';

test.describe('Edit Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test(
    'should allow editing an existing Consultation from Condition view',
    { tag: ['@smoke'] },
    async ({ page }) => {
      let conditionId = '';
      let consultationId = '';

      await test.step('Seed condition with consultation', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Hypertension Monitoring',
        });
        conditionId = cond.id;

        const cons = await seedTestConsultation(page, {
          conditionId,
          title: 'Initial Checkup',
          doctorName: 'Dr. Watson',
          date: '2026-10-01',
          notes: 'Preliminary assessment.',
        });
        consultationId = cons.id;
        await page.reload();
      });

      await test.step('Open Condition view and click edit consultation', async () => {
        await page.getByTestId(`condition-card-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        const editBtn = page.getByTestId(
          `edit-consultation-button-${consultationId}`
        );
        await editBtn.click();
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}\\/edit`)
        );
        await expect(page.getByText('Edit Consultation')).toBeVisible();

        const titleInput = page.getByTestId('consultation-title-input');
        await expect(titleInput).toHaveValue('Initial Checkup');

        const doctorInput = page.getByTestId('consultation-doctor-input');
        await expect(doctorInput).toHaveValue('Dr. Watson');

        await titleInput.fill('Follow-up Examination');
        await doctorInput.fill('Dr. John Watson');
        await page.getByTestId('save-button').click();
      });

      await test.step('Verify Condition view reflects updated consultation', async () => {
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(page.getByText('Follow-up Examination')).toBeVisible();
        await expect(page.getByText('Dr. John Watson')).toBeVisible();
      });
    }
  );

  test(
    'should allow deleting a Consultation from Condition view with confirmation modal',
    { tag: ['@critical'] },
    async ({ page }) => {
      let conditionId = '';
      let consultationId = '';

      await test.step('Seed condition with consultation', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Migraine Study',
        });
        conditionId = cond.id;

        const cons = await seedTestConsultation(page, {
          conditionId,
          title: 'Consultation To Delete',
          doctorName: 'Dr. Strange',
          date: '2026-10-02',
        });
        consultationId = cons.id;
        await page.reload();
      });

      await test.step('Open Condition view and test delete cancellation', async () => {
        await page.getByTestId(`condition-card-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        const deleteBtn = page.getByTestId(
          `delete-consultation-button-${consultationId}`
        );
        await deleteBtn.click();

        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();
        await expect(page.getByText('Delete Consultation')).toBeVisible();

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByText('Consultation To Delete')).toBeVisible();
      });

      await test.step('Re-open modal, verify countdown, and confirm deletion', async () => {
        await page.clock.install();
        const deleteBtn = page.getByTestId(
          `delete-consultation-button-${consultationId}`
        );
        await deleteBtn.click();

        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
        await expect(confirmBtn).toContainText('Delete (');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
        await confirmBtn.click();
      });

      await test.step('Verify consultation removed from Condition view', async () => {
        await expect(
          page.getByText('Consultation To Delete')
        ).not.toBeVisible();
        await expect(page.getByTestId('empty-consultations')).toBeVisible();
      });
    }
  );
});
