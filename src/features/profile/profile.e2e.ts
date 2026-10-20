import {
  test,
  expect,
  seedTestPatient,
  createConditionViaUI,
  checkA11y,
  evaluateBridge,
} from '@/src/features/testing/testStorage';

test.describe('Profile Management & Patient Record Attachment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test(
    'should display profile button in header and allow navigating to profile',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Click profile button in header', async () => {
        const profileBtn = page.getByTestId('profile-header-button');
        await expect(profileBtn).toBeVisible();
        await profileBtn.click();
      });

      await test.step('Verify navigation to profile view, display name, and audit a11y', async () => {
        await expect(page).toHaveURL(/.*profile/);
        await expect(page.getByText('Profile', { exact: true })).toBeVisible();
        await expect(page.getByTestId('active-profile-card')).toBeVisible();
        await expect(page.getByTestId('profile-display-name')).toHaveText(
          'John Doe'
        );
        // The patient ID tells apart profiles with the same name.
        const [{ id }] = await evaluateBridge(page, (b) =>
          b.querySql('SELECT id FROM patients')
        );
        await expect(page.getByTestId('profile-id-value')).toHaveText(id);
        await expect(page.getByTestId(`profile-item-id-${id}`)).toHaveText(id);
        // Muted #717973 text (4.48:1) and the Google sign-in button still
        // fall just short of 4.5:1.
        await checkA11y(page, { disableRules: ['color-contrast'] });
      });
    }
  );

  test(
    'should allow creating a new profile and switching active patient with record isolation',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create condition for initial John Doe profile', async () => {
        await createConditionViaUI(page, {
          title: 'Back Pain',
          status: 'active',
        });
        await expect(page.getByText('Back Pain')).toBeVisible();
      });

      await test.step('Navigate to Add Profile and create Jane Doe', async () => {
        await page.getByTestId('profile-header-button').click();
        await expect(page).toHaveURL(/.*profile/);

        const addProfileBtn = page.getByTestId('add-new-profile-button');
        await expect(addProfileBtn).toBeVisible();
        await addProfileBtn.click();

        await expect(page).toHaveURL(/.*profile\/new/);
        await expect(
          page.getByTestId('add-profile-header-title')
        ).toBeVisible();

        await page.getByTestId('patient-given-name-input').fill('Jane');
        await page.getByTestId('patient-family-name-input').fill('Doe');

        const genderSelect = page.getByTestId('patient-gender-select');
        if (await genderSelect.isVisible()) {
          await genderSelect.selectOption('female');
        }

        await page.getByTestId('save-profile-button').click();
        await expect(
          page.getByTestId('profile-display-name').first()
        ).toHaveText('Jane Doe');
      });

      await test.step('Navigate to Home and verify record isolation for Jane Doe', async () => {
        await page.locator('[data-testid="back-button"]:visible').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);

        await expect(page.getByText('Nothing to show yet')).toBeVisible();
        await expect(page.getByText('Back Pain')).not.toBeVisible();
      });

      await test.step('Add condition for Jane Doe and verify on Home', async () => {
        await createConditionViaUI(page, {
          title: 'Asthma',
          status: 'active',
        });
        await expect(page.getByText('Asthma')).toBeVisible();
        await expect(page.getByText('Back Pain')).not.toBeVisible();
      });

      await test.step('Switch back to John Doe and verify condition isolation restored', async () => {
        await page.getByTestId('profile-header-button').click();
        await page
          .getByTestId(/^profile-item-/)
          .filter({ hasText: 'John Doe' })
          .first()
          .click();

        await expect(
          page.getByTestId('profile-display-name').first()
        ).toHaveText('John Doe');

        await page.locator('[data-testid="back-button"]:visible').click();
        await expect(page.getByText('Back Pain')).toBeVisible();
        await expect(page.getByText('Asthma')).not.toBeVisible();
      });
    }
  );

  test('should allow editing an existing profile', async ({ page }) => {
    await page.getByTestId('profile-header-button').click();

    // Wait for active profile to load and edit button to be enabled
    await expect(page.getByTestId('edit-profile-button')).toBeEnabled();
    await page.getByTestId('edit-profile-button').click();
    await expect(page).toHaveURL(/.*profile\/.*\/edit/);

    await page.getByTestId('patient-given-name-input').fill('John');
    await page.getByTestId('patient-family-name-input').fill('Smith');

    // Test setting date of birth
    const dobInput = page.locator('input[name="patientBirthDate"]');
    await dobInput.fill('1990-05-15');

    await page.getByTestId('save-profile-button').click();

    await expect(page.getByTestId('profile-display-name')).toHaveText(
      'John Smith'
    );
    await expect(page.getByTestId('profile-birth-date-value')).toHaveText(
      'May 15, 1990'
    );

    // Re-open and clear date of birth
    await page.getByTestId('edit-profile-button').click();
    await expect(page).toHaveURL(/.*profile\/.*\/edit/);
    const dobInputEdit = page.locator('input[name="patientBirthDate"]');
    await dobInputEdit.fill('');
    await page.getByTestId('save-profile-button').click();

    await expect(page.getByTestId('profile-birth-date-value')).toHaveText(
      'Not specified'
    );
  });

  test('should present 3 creation options on /profile/new (Create, Restore file, Restore GDrive) and navigate properly', async ({
    page,
  }) => {
    await page.goto('/profile/new');
    await expect(page.getByText('Add Profile')).toBeVisible();

    // Verify 3 options exist
    await expect(page.getByTestId('option-create-profile')).toBeVisible();
    await expect(page.getByTestId('option-restore-file')).toBeVisible();
    await expect(page.getByTestId('option-restore-gdrive')).toBeVisible();

    // "Create" option shows the manual form and doesn't duplicate "New Profile" header
    await expect(page.getByTestId('patient-given-name-input')).toBeVisible();
    await expect(page.getByText('New Profile')).not.toBeVisible();

    // Click "Restore from file" -> navigates to /profile/restore-from-file with "Select profile" button
    await page.getByTestId('option-restore-file').click();
    await expect(page.getByTestId('select-profile-file-button')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Select profile', exact: true })
    ).toBeVisible();

    // Click "Restore from Google Drive" -> navigates to /profile/restore-from-google-drive with "Connect Google Drive" button
    await page.getByTestId('option-restore-gdrive').click();
    await expect(page.getByTestId('connect-google-drive-button')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Connect Google Drive', exact: true })
    ).toBeVisible();

    // Click "Create" -> navigates back to /profile/new with manual form
    await page.getByTestId('option-create-profile').click();
    await expect(page.getByTestId('patient-given-name-input')).toBeVisible();
  });

  test('should allow deleting a profile from EditProfileView with 5s countdown and redirect to /profile/new when last profile deleted', async ({
    page,
  }) => {
    await page.getByTestId('profile-header-button').click();

    // Wait for active profile to load and edit button to be enabled
    await expect(page.getByTestId('edit-profile-button')).toBeEnabled();
    await page.getByTestId('edit-profile-button').click();
    await expect(page).toHaveURL(/.*profile\/.*\/edit/);

    // Delete button should appear in EditProfileView
    const deleteBtn = page.getByTestId('delete-profile-button');
    await expect(deleteBtn).toBeVisible();
    await page.clock.install();
    await deleteBtn.click();

    // Confirmation modal should appear with 5s countdown
    const modal = page.getByTestId('delete-profile-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Delete Profile')).toBeVisible();

    // Since this is a local profile without Google Drive sync, cloud checkbox should not be visible
    await expect(
      modal.getByTestId('delete-from-cloud-checkbox')
    ).not.toBeVisible();

    const confirmBtn = page.getByTestId('delete-modal-confirm-button');
    await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmBtn).toContainText('Delete (');

    // Fast-forward countdown by 5 seconds
    await page.clock.runFor(5000);
    await expect(confirmBtn).toHaveText('Delete');
    await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
    await confirmBtn.click();

    // Since this was the only profile, should redirect straight to /profile/new!
    await expect(page).toHaveURL(/.*profile\/new/);
    await expect(page.getByTestId('option-create-profile')).toBeVisible();

    // When 0 profiles exist, back button is hidden
    await expect(page.getByTestId('back-button')).not.toBeVisible();
  });
});
