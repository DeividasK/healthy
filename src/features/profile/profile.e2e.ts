import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  seedEveryResource,
  createConditionViaUI,
  checkA11y,
  openRoute,
  evaluateBridge as bridge,
  TEST_PHOTO_PNG,
} from '@/src/features/testing/testStorage';

test.describe('Profile Management & Patient Record Attachment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

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
        await page.getByTestId('switch-profile-button').click();

        const addProfileBtn = page.getByTestId('add-new-profile-button');
        await expect(addProfileBtn).toBeVisible();
        await addProfileBtn.click();

        await expect(page).toHaveURL(/.*profile\/new/);
        await expect(
          page.getByTestId('add-profile-header-title')
        ).toBeVisible();

        // Only the name shows; the other details wait behind +.
        await expect(
          page.getByTestId('patient-given-name-input')
        ).toBeFocused();
        await expect(page.getByTestId('patient-family-name-input')).toHaveCount(
          0
        );
        await expect(page.getByTestId('patient-gender-select')).toHaveCount(0);
        await expect(page.getByTestId('patient-birth-date-picker')).toHaveCount(
          0
        );
        await page.getByTestId('patient-given-name-input').fill('Jane');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-family-name').click();
        await expect(
          page.getByTestId('patient-family-name-input')
        ).toBeFocused();
        await page.getByTestId('patient-family-name-input').fill('Doe');
        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-birth-date').click();
        await expect(
          page.getByTestId('patient-birth-date-picker')
        ).toBeVisible();
        // Its x clears the field and returns it to the menu.
        await page.getByTestId('remove-birth-date-button').click();
        await expect(page.getByTestId('patient-birth-date-picker')).toHaveCount(
          0
        );
        await page.getByTestId('add-option-button').click();
        await expect(page.getByTestId('menu-add-birth-date')).toBeVisible();
        await page.keyboard.press('Escape');

        await page.getByTestId('save-profile-button').click();
      });

      await test.step('The new profile opens on its own empty Home', async () => {
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByTestId('start-your-record-heading')).toHaveText(
          "Jane's record"
        );
        await expect(page.getByText('Back Pain')).not.toBeVisible();
        await openRoute(page, '/profile');
        await expect(
          page.getByTestId('profile-display-name').first()
        ).toHaveText('Jane Doe');
        await expect(page.getByTestId('profile-birth-date-value')).toHaveCount(
          0
        );
        await openRoute(page, '/');
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
        await page.getByTestId('switch-profile-button').click();
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

  test('opens the profile from the header, edits it, offers adding another and deletes it', async ({
    page,
  }) => {
    await page.getByTestId('profile-header-button').click();
    await expect(page).toHaveURL(/.*profile/);
    await expect(page.getByTestId('profile-display-name')).toHaveText(
      'John Doe'
    );
    // The patient ID tells apart profiles with the same name; it copies whole.
    const [{ id }] = await bridge(page, (b) =>
      b.querySql('SELECT id FROM patients')
    );
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('profile-id-copy-button').click();
    await expect(
      page.getByRole('button', { name: 'Patient ID copied' })
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);

    // The switcher opens from the header and lists the profile as active.
    await page.getByTestId('switch-profile-button').click();
    await expect(page.getByTestId(`profile-item-${id}`)).toHaveAttribute(
      'aria-current',
      'true'
    );
    await expect(page.getByTestId('add-new-profile-button')).toBeVisible();
    await page.getByTestId('switch-profile-button').click();
    await expect(page.getByTestId('profile-switcher')).toHaveCount(0);
    // Muted #717973 text (4.48:1) and the Google sign-in button still
    // fall just short of 4.5:1.
    await checkA11y(page, { disableRules: ['color-contrast'] });

    // Wait for active profile to load and edit button to be enabled
    await expect(page.getByTestId('edit-profile-button')).toBeEnabled();
    await page.getByTestId('edit-profile-button').click();
    await expect(page).toHaveURL(/.*profile\/.*\/edit/);

    await page.getByTestId('patient-given-name-input').fill('John');
    await page.getByTestId('patient-family-name-input').fill('Smith');

    // Date of birth waits behind + until added.
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-birth-date').click();
    const dobInput = page.locator('input[name="patientBirthDate"]');
    await dobInput.fill('1990-05-15');

    await page.getByTestId('save-profile-button').click();

    await expect(page.getByTestId('profile-display-name')).toHaveText(
      'John Smith'
    );
    await expect(page.getByTestId('profile-birth-date-value')).toHaveText(
      /^May 15, 1990, \d+ years$/
    );

    // Re-open: the stored date shows with its x, which clears it.
    await page.getByTestId('edit-profile-button').click();
    await expect(page).toHaveURL(/.*profile\/.*\/edit/);
    await expect(page.locator('input[name="patientBirthDate"]')).toHaveValue(
      '1990-05-15'
    );
    await page.getByTestId('remove-birth-date-button').click();
    await page.getByTestId('save-profile-button').click();

    await expect(page.getByTestId('profile-birth-date-value')).toHaveCount(0);

    await test.step('Uploads a profile photo, shows it and removes it', async () => {
      await page.getByTestId('edit-profile-button').click();
      await page.getByTestId('add-option-button').click();
      await page.getByTestId('menu-add-photo').click();
      const fileChooser = page.waitForEvent('filechooser');
      await page.getByTestId('upload-photo-button').click();
      await (
        await fileChooser
      ).setFiles({
        name: 'photo.png',
        mimeType: 'image/png',
        buffer: Buffer.from(TEST_PHOTO_PNG, 'base64'),
      });
      await expect(
        page.getByTestId('patient-avatar-preview-photo')
      ).toBeVisible();
      await expect(page.getByTestId('upload-photo-button')).toHaveText(
        'Change photo'
      );
      await page.getByTestId('save-profile-button').click();
      await page.getByTestId('switch-profile-button').click();

      for (const avatar of [
        'profile-avatar',
        'profile-header-avatar',
        `profile-item-avatar-${id}`,
      ])
        await expect(page.getByTestId(`${avatar}-photo`)).toBeVisible();
      // Stored as a square JPEG on the FHIR Patient, so it syncs and exports.
      const [row] = await bridge(page, (b) =>
        b.querySql('SELECT fhir_json FROM patients')
      );
      expect(JSON.parse(row.fhir_json).photo).toEqual([
        {
          contentType: 'image/jpeg',
          data: expect.stringMatching(/^\/9j\//),
          width: 16,
          height: 16,
        },
      ]);

      await page.getByTestId('edit-profile-button').click();
      await expect(
        page.getByTestId('patient-avatar-preview-photo')
      ).toBeVisible();
      await page.getByTestId('remove-photo-button').click();
      await expect(page.getByTestId('remove-photo-button')).toHaveCount(0);
      await page.getByTestId('save-profile-button').click();
      await expect(page.getByTestId('profile-avatar')).toHaveText('JS');
      await expect(page.getByTestId('profile-header-avatar-photo')).toHaveCount(
        0
      );
    });

    await test.step('Offers creating or restoring another profile', async () => {
      await openRoute(page, '/profile/new');
      await expect(page.getByTestId('add-profile-header-title')).toHaveText(
        'Add a profile'
      );
      await expect(page.getByTestId('patient-given-name-input')).toBeVisible();
      await expect(page.getByText('New Profile')).not.toBeVisible();

      // Restoring is one row away, on the shared Restore screen.
      await page.getByTestId('add-profile-restore').click();
      await expect(page).toHaveURL(/\/profile\/restore$/);
      await expect(page.getByTestId('restore-profile-title')).toHaveText(
        'Restore a profile'
      );
      await expect(page.getByTestId('restore-from-google-drive')).toBeVisible();
      await expect(page.getByTestId('restore-from-file')).toBeVisible();
      await page.getByTestId('back-button').click();
      await expect(page).toHaveURL(/\/profile\/new$/);
    });

    await test.step('Deletes the last profile from its edit form', async () => {
      await openRoute(page, '/profile');
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

      await page.clock.runFor(5000);
      await page.getByTestId('delete-modal-confirm-button').click();

      // With no profile left, the device starts over at Welcome.
      await expect(page).toHaveURL(/\/welcome$/);
      await expect(page.getByTestId('welcome-title')).toBeVisible();

      // When 0 profiles exist, back button is hidden
      await expect(page.getByTestId('back-button')).not.toBeVisible();
    });
  });
});

test('keeps every record to its own profile on every screen', async ({
  page,
}) => {
  await seedEveryResource(page);
  await seedTestReport(page, {
    patientId: 'shared-patient',
    biomarkers: [{ name: 'Red Blood Cells', value: 4.5 }],
  });
  await seedTestPatient(page, { id: 'other-patient', givenName: 'Bob' });
  await seedTestReport(page, {
    biomarkers: [{ name: 'Red Blood Cells', value: 6.1 }],
  });
  const switchTo = (id: string) =>
    bridge(page, (b, id) => b.setActivePatient(id), id);

  // Home lists only the active profile's records.
  await openRoute(page, '/');
  await expect(page.getByTestId('biomarker-row-789-8')).toContainText('6.1');
  for (const title of [
    'Private asthma diagnosis',
    'Respiratory review',
    'Treatment to back up',
    'Request to back up',
  ])
    await expect(page.getByText(title)).toHaveCount(0);

  // Another profile's records are not found by direct entry either.
  for (const [path, message] of [
    ['/condition/asthma', 'Condition not found.'],
    ['/consultation/visit', 'Consultation not found.'],
    ['/treatment/inhaler', 'Treatment not found.'],
    ['/service-request/referral', 'Service request not found.'],
    ['/lab-result/cbc', 'Lab result not found.'],
  ]) {
    await openRoute(page, path);
    await expect(page.getByText(message)).toBeVisible();
  }

  // Biomarker history and the labs summary follow profile changes live.
  await openRoute(page, '/biomarker/789-8');
  const latest = page.getByTestId('biomarker-latest-value');
  const history = page.getByTestId('biomarker-history-list');
  await expect(latest).toHaveText('6.1');
  await expect(history.getByText('4.5', { exact: true })).toHaveCount(0);
  await switchTo('shared-patient');
  await expect(latest).toHaveText('4.5');
  await expect(history.getByText('6.1', { exact: true })).toHaveCount(0);

  await openRoute(page, '/labs-summary');
  const summary = page.getByTestId('labs-summary-view');
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('2');
  await expect(summary.getByTestId('labs-summary-result-789-8')).toContainText(
    '4.5'
  );
  await switchTo('other-patient');
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('1');
  await expect(summary.getByTestId('labs-summary-result-789-8')).toContainText(
    '6.1'
  );
  await expect(summary.getByTestId('labs-summary-result-718-7')).toHaveCount(0);

  // An open edit form unmounts, dropping its draft, and reloads on return.
  await switchTo('shared-patient');
  await openRoute(page, '/treatment/inhaler/edit');
  const title = page.getByTestId('treatment-title-input');
  await expect(title).toHaveValue('Treatment to back up');
  await title.fill('Unsaved private draft');
  await switchTo('other-patient');
  await expect(page.getByTestId('edit-treatment-not-found')).toBeVisible();
  await expect(title).toHaveCount(0);
  await switchTo('shared-patient');
  await expect(title).toHaveValue('Treatment to back up');
});
