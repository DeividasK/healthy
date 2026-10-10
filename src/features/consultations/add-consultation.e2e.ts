import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Add Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test(
    'should allow creating a Consultation from Condition view and audit a11y',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed a condition and navigate to it from Home', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Cardiology Overview',
          status: 'active',
        });
        conditionId = cond.id;
        await page.reload();

        const condCard = page.getByTestId(`condition-card-${conditionId}`);
        await expect(condCard).toBeVisible();
        await condCard.click();

        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Cardiology Overview'
        );
      });

      await test.step('Click bottom floating add button in Condition view', async () => {
        const addBtn = page.getByTestId('add-consultation-to-condition-button');
        await expect(addBtn).toBeVisible();
        await addBtn.click();

        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/add\\?conditionId=${conditionId}`)
        );
        await expect(page.getByText('New Consultation')).toBeVisible();
        await checkA11y(page, { disableRules: ['color-contrast'] });
      });

      await test.step('Fill consultation form fields', async () => {
        const titleInput = page.getByTestId('consultation-title-input');
        await titleInput.fill('General Cardiology Review');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-doctor').click();
        const doctorInput = page.getByTestId('consultation-doctor-input');
        await doctorInput.fill('Dr. Marcus Welby');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-notes').click();
        const notesInput = page.getByTestId('consultation-notes-input');
        await notesInput.fill('Follow-up in 6 months. Blood pressure stable.');
      });

      await test.step('Save consultation and verify card in Condition view', async () => {
        await page.getByTestId('save-button').click();

        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        const consultationsSection = page.getByTestId(
          'condition-consultations-section'
        );
        await expect(consultationsSection).toBeVisible();
        await expect(
          consultationsSection.getByText('General Cardiology Review')
        ).toBeVisible();
        await expect(
          consultationsSection.getByText('Dr. Marcus Welby')
        ).toBeVisible();
        await expect(
          consultationsSection.getByText(
            '"Follow-up in 6 months. Blood pressure stable."'
          )
        ).toBeVisible();

        const editBtn = page.getByTestId(/^edit-consultation-button-/);
        const deleteBtn = page.getByTestId(/^delete-consultation-button-/);
        await expect(editBtn).toBeVisible();
        await expect(deleteBtn).toBeVisible();
      });

      await test.step('Verify consultation is not on Home view', async () => {
        await page.getByTestId('back-button').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);
        // Home view should NOT have consultations
        await expect(
          page.getByText('General Cardiology Review')
        ).not.toBeVisible();
        await expect(page.getByText('Dr. Marcus Welby')).not.toBeVisible();
      });
    }
  );

  test(
    'should autocomplete doctor name from previously saved records',
    { tag: ['@smoke'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed prior consultation with a doctor under a condition', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Chronic Migraine',
        });
        conditionId = cond.id;
        await seedTestConsultation(page, {
          conditionId,
          title: 'Initial Consultation',
          doctorName: 'Dr. Gregory House',
          date: '2026-10-01',
        });
        await page.reload();
      });

      await test.step('Open Condition view and click add consultation', async () => {
        await page.getByTestId(`condition-card-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        await page.getByTestId('add-consultation-to-condition-button').click();
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/add\\?conditionId=${conditionId}`)
        );

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-doctor').click();

        const doctorInput = page.getByTestId('consultation-doctor-input');
        await doctorInput.click();
        await doctorInput.fill('Greg');

        const suggestion = page.getByTestId('doctor-autocomplete-item-0');
        await expect(suggestion).toBeVisible();
        await expect(suggestion).toHaveText('Dr. Gregory House');

        await suggestion.click();
        await expect(doctorInput).toHaveValue('Dr. Gregory House');
      });
    }
  );

  test(
    'should verify separate Condition View and Condition Edit flows',
    { tag: ['@critical'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed a condition with a consultation', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Knee Osteoarthritis',
          status: 'active',
        });
        conditionId = cond.id;
        await seedTestConsultation(page, {
          conditionId,
          title: 'Knee Arthroscopy Review',
          doctorName: 'Dr. John Doe',
        });
        await page.reload();
      });

      await test.step('Open Condition View and navigate to Condition Edit', async () => {
        await page.getByTestId(`condition-card-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        // Consultations and floating + are in Condition View
        await expect(
          page.getByTestId('condition-consultations-section')
        ).toBeVisible();
        await expect(
          page.getByTestId('add-consultation-to-condition-button')
        ).toBeVisible();

        // Click edit condition button
        await page.getByTestId('edit-condition-button').click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}\\/edit`)
        );

        // Consultations and floating + are NOT in Condition Edit
        await expect(
          page.getByTestId('condition-consultations-section')
        ).not.toBeVisible();
        await expect(
          page.getByTestId('add-consultation-to-condition-button')
        ).not.toBeVisible();
      });

      await test.step('Edit condition in Condition Edit and save', async () => {
        const titleInput = page.getByTestId('condition-title-input');
        await titleInput.fill('Updated Knee Osteoarthritis');
        await page.getByTestId('save-button').click();

        // Returns to Condition View
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Updated Knee Osteoarthritis'
        );
        await expect(
          page.getByTestId('condition-consultations-section')
        ).toBeVisible();
      });
    }
  );

  test(
    'should allow creating a standalone Consultation from Home view floating menu',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      await test.step('Open floating menu on Home view and select Add Consultation', async () => {
        await page.goto('/');
        const floatingBtn = page.getByTestId('floating-add-button');
        await expect(floatingBtn).toBeVisible();
        await floatingBtn.click();

        const addConsultationMenuItem = page.getByTestId(
          'menu-add-consultation'
        );
        await expect(addConsultationMenuItem).toBeVisible();
        await addConsultationMenuItem.click();

        await expect(page).toHaveURL(/.*consultation\/add/);
        await expect(page.getByText('New Consultation')).toBeVisible();
      });

      await test.step('Fill standalone consultation form and save', async () => {
        const titleInput = page.getByTestId('consultation-title-input');
        await titleInput.fill('Annual Physical Exam');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-doctor').click();
        const doctorInput = page.getByTestId('consultation-doctor-input');
        await doctorInput.fill('Dr. Beverly Crusher');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-notes').click();
        const notesInput = page.getByTestId('consultation-notes-input');
        await notesInput.fill('All vital signs optimal. Recommended vitamins.');

        await page.getByTestId('save-button').click();
      });

      await test.step('Verify standalone consultation is displayed on Home view', async () => {
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Consultations')).toBeVisible();
        await expect(page.getByText('Annual Physical Exam')).toBeVisible();
        await expect(page.getByText('Dr. Beverly Crusher')).toBeVisible();
        await expect(
          page.getByText('"All vital signs optimal. Recommended vitamins."')
        ).toBeVisible();
      });

      await test.step('Edit standalone consultation from Home view', async () => {
        const editBtn = page.getByTestId(/^edit-consultation-button-/);
        await expect(editBtn).toBeVisible();
        await editBtn.click();

        await expect(page).toHaveURL(/.*consultation\/.*\/edit/);
        const titleInput = page.getByTestId('consultation-title-input');
        await expect(titleInput).toHaveValue('Annual Physical Exam');
        await titleInput.fill('Updated Physical Exam');
        await page.getByTestId('save-button').click();

        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Updated Physical Exam')).toBeVisible();
      });

      await test.step('Delete standalone consultation from Home view', async () => {
        await page.clock.install();
        const deleteBtn = page.getByTestId(/^delete-consultation-button-/);
        await expect(deleteBtn).toBeVisible();
        await deleteBtn.click();

        // Confirm modal with countdown
        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toBeVisible();
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
        await confirmBtn.click();

        await expect(page.getByText('Updated Physical Exam')).not.toBeVisible();
      });
    }
  );

  test(
    'should support future date, optional consultation time, serviceType, and removable condition',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed condition and navigate to Add Consultation via Condition view', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Heart Health Review',
          status: 'active',
        });
        conditionId = cond.id;
        await page.goto(`/condition/${conditionId}`);
        await expect(page.getByTestId('condition-title')).toBeVisible();
        await page.getByTestId('add-consultation-to-condition-button').click();
        await expect(page.getByText('New Consultation')).toBeVisible();
      });

      await test.step('Verify condition pill is present and test removal and re-addition', async () => {
        const conditionPill = page.getByTestId('condition-picker-button');
        await expect(conditionPill).toBeVisible();
        await expect(conditionPill).toContainText('Heart Health Review');

        // Remove condition
        const removeCondBtn = page.getByTestId('remove-condition-button');
        await expect(removeCondBtn).toBeVisible();
        await removeCondBtn.click();

        await expect(conditionPill).not.toBeVisible();

        // Re-add condition via + menu
        await page.getByTestId('add-option-button').click();
        const addCondMenu = page.getByTestId('menu-add-condition');
        await expect(addCondMenu).toBeVisible();
        await addCondMenu.click();

        await expect(conditionPill).toBeVisible();
      });

      await test.step('Set future consultation date without validation restriction', async () => {
        const dateInput = page.locator('#date-picker-button-native-input');
        await dateInput.fill('2028-11-20');
        await expect(page.getByTestId('date-picker-button')).toContainText(
          '2028'
        );
      });

      await test.step('Add consultation time via + menu', async () => {
        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-time').click();

        const timePicker = page.getByTestId('time-picker-button');
        await expect(timePicker).toBeVisible();

        const timeInput = page.locator('#time-picker-button-native-input');
        await timeInput.fill('15:45');
        await expect(timePicker).toContainText('15:45');
      });

      await test.step('Add serviceType via + menu and select autocomplete', async () => {
        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-service-type').click();

        const serviceTypeInput = page.getByTestId(
          'consultation-service-type-input'
        );
        await expect(serviceTypeInput).toBeVisible();
        await serviceTypeInput.fill('Cardio');

        const suggestion = page.getByTestId('service-type-autocomplete-item-0');
        await expect(suggestion).toBeVisible();
        await expect(suggestion).toHaveText('Cardiology');
        await suggestion.click();

        await expect(serviceTypeInput).toHaveValue('Cardiology');
      });

      await test.step('Fill title and save consultation', async () => {
        const titleInput = page.getByTestId('consultation-title-input');
        await titleInput.fill('Future Cardiology Assessment');

        await page.getByTestId('save-button').click();

        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
      });

      await test.step('Verify consultation details render on Condition View', async () => {
        const consultationsSection = page.getByTestId(
          'condition-consultations-section'
        );
        await expect(consultationsSection).toBeVisible();
        await expect(
          consultationsSection.getByText('Future Cardiology Assessment')
        ).toBeVisible();
        await expect(
          consultationsSection.getByText('Cardiology', { exact: true })
        ).toBeVisible();
        await expect(
          consultationsSection.getByText(/Nov 20, 2028.*15:45/)
        ).toBeVisible();
      });
    }
  );
});
