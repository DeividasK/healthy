import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
} from '@/src/features/testing/testStorage';

test.describe('Edit Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
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
          conditionIds: [conditionId],
          title: 'Initial Checkup',
          doctorName: 'Dr. Watson',
          date: '2026-10-01',
          notes: 'Preliminary assessment.',
        });
        consultationId = cons.id;
      });

      await test.step('Open the consultation view from Condition and edit it', async () => {
        await page.getByTestId(`condition-open-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        await page
          .getByTestId(`condition-consultation-item-${consultationId}`)
          .click();
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}$`)
        );
        await page.getByTestId('consultation-diagnosis-condition').click();
        await expect(
          page.locator('[data-testid="condition-title"]:visible')
        ).toHaveText('Hypertension Monitoring');
        await page.getByTestId('back-button').click();
        await page.getByTestId('edit-consultation-button').click();
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

      await test.step('Verify the consultation view reflects the update', async () => {
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}$`)
        );
        await expect(page.getByTestId('consultation-title')).toHaveText(
          'Follow-up Examination'
        );
        await expect(
          page.getByTestId('consultation-view').getByText('Dr. John Watson')
        ).toBeVisible();
      });
    }
  );

  test(
    'should delete a linked Consultation from its view page with confirmation modal',
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
          conditionIds: [conditionId],
          title: 'Consultation To Delete',
          doctorName: 'Dr. Strange',
          date: '2026-10-02',
        });
        consultationId = cons.id;
      });

      await test.step('Open the consultation view and test delete cancellation', async () => {
        await page.getByTestId(`condition-open-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        await page
          .getByTestId(`condition-consultation-item-${consultationId}`)
          .click();
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}$`)
        );

        const deleteBtn = page.getByTestId('delete-consultation-button');
        await deleteBtn.click();

        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();
        await expect(page.getByText('Delete Consultation')).toBeVisible();

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByTestId('consultation-title')).toHaveText(
          'Consultation To Delete'
        );
      });

      await test.step('Re-open modal, verify countdown, and confirm deletion', async () => {
        await page.clock.install();
        await page.getByTestId('delete-consultation-button').click();

        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
        await expect(confirmBtn).toContainText('Delete (');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
        await confirmBtn.click();
      });

      await test.step('Verify consultation removed from Condition view and pending deletion persisted', async () => {
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(
          page.getByText('Consultation To Delete')
        ).not.toBeVisible();
        await expect(
          page.getByTestId('condition-consultations-section')
        ).toHaveCount(0);

        const pendingDeletions = await page.evaluate(() => {
          return localStorage.getItem('@healthy_pending_deleted_consultations');
        });
        expect(pendingDeletions).toContain(consultationId);
      });
    }
  );
});
