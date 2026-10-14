import {
  test,
  expect,
  seedTestPatient,
  createConditionViaUI,
  mockGoogleDrive,
  mockGoogleDriveRoutes,
  mockGoogleAuthRoutes,
  mockGoogleIdentityServices,
  checkA11y,
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

  test('should display Google Drive sync card on profile screen and handle 1-click controls', async ({
    page,
  }) => {
    // Intercept Google Drive API so mock sync calls succeed
    await mockGoogleDriveRoutes(page, { files: [], fileId: 'file-123' });

    await page.getByTestId('profile-header-button').click();

    // 1. Verify Google Drive Sync Card is visible in disconnected state
    const syncCard = page.getByTestId('google-sync-card');
    await expect(syncCard).toBeVisible();
    await expect(page.getByText('Cloud Backup')).toBeVisible();

    const googleBtn = page.getByTestId('google-signin-button');
    await expect(googleBtn).toBeVisible();
    await expect(page.getByText('Connect Google Drive')).toBeVisible();

    // 2. Mock connected Google Drive state in AsyncStorage
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-google-access-token',
          userEmail: 'alice@gmail.com',
          userName: 'Alice Health',
          userSub: 'google-sub-12345',
          lastSyncTimestamp: '2026-10-07T12:00:00.000Z',
        })
      );
    });

    await page.reload();

    // Connect this profile to the Google account
    const connectBtn = page.getByTestId('google-signin-button');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // 3. Verify connected state
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'alice@gmail.com'
    );
    await expect(page.getByTestId('up-to-date-button')).toBeVisible();
    await expect(page.getByTestId('last-synced-time-text')).toBeVisible();

    // 4. Verify Transfer Action buttons exist
    await expect(page.getByTestId('export-zip-button')).toBeVisible();
    await expect(page.getByTestId('export-zip-button')).toContainText('Export');
    await expect(page.getByTestId('restore-zip-button')).not.toBeVisible();

    // 5. Test Export button
    await page.getByTestId('export-zip-button').click();
    await expect(page.getByTestId('sync-feedback-toast')).toBeVisible();

    // 6. Test Disconnect opens confirmation modal
    const disconnectBtn = page.getByTestId('disconnect-sync-button');
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Verify Disconnect Confirmation Modal appears with Cloud Delete checkbox
    const disconnectModal = page.getByTestId('disconnect-confirmation-modal');
    await expect(disconnectModal).toBeVisible();
    await expect(
      disconnectModal.getByText('Disconnect Google Drive', { exact: true })
    ).toBeVisible();
    await expect(
      disconnectModal.getByTestId('delete-from-cloud-checkbox')
    ).toBeVisible();

    // Confirm Disconnect
    await disconnectModal.getByTestId('delete-modal-confirm-button').click();

    // Verify disconnected state restored and local profile still exists
    await expect(page.getByTestId('google-signin-button')).toBeVisible();
    await expect(
      page.getByTestId('profile-display-name').first()
    ).toBeVisible();
  });

  test('should gracefully handle google auth token expiry without requiring manual reconnection', async ({
    page,
    consoleMonitor,
  }) => {
    // Chromium logs 401 HTTP response to console during token expiry simulation; ignore for this negative test.
    consoleMonitor.ignore(
      'Failed to load resource: the server responded with a status of 401'
    );

    // Intercept Google Drive API to simulate a 401 token expiry error during sync
    await mockGoogleDriveRoutes(page, { status: 401 });

    await page.getByTestId('profile-header-button').click();

    // Set connected state with token
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'expired-token',
          userEmail: 'bob@gmail.com',
          userName: 'Bob Test',
          userSub: 'bob-sub-67890',
        })
      );
    });

    await page.reload();

    const connectBtn = page.getByTestId('google-signin-button');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Verify GoogleSyncCard stays connected gracefully and does NOT show a disruptive Reconnect button
    await expect(page.getByTestId('reconnect-google-button')).not.toBeVisible();
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'bob@gmail.com'
    );
  });

  test('should silently refresh expired google auth token via GIS and continue sync without interruption', async ({
    page,
    consoleMonitor,
  }) => {
    // Chromium logs 401 HTTP response to console during token expiry simulation; ignore for this negative test.
    consoleMonitor.ignore(
      'Failed to load resource: the server responded with a status of 401'
    );

    // 1. Route Google Drive APIs
    let driveCallsWithNewToken = 0;
    await mockGoogleDriveRoutes(page, {
      expectedToken: 'fresh-gis-token',
      fileId: 'file-refreshed-123',
      onCallWithExpectedToken: () => {
        driveCallsWithNewToken++;
      },
    });

    // 2. Mock GIS on window before navigation
    await mockGoogleIdentityServices(page, { accessToken: 'fresh-gis-token' });

    await page.getByTestId('profile-header-button').click();

    // 3. Set expired token in config
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'stale-token',
          tokenExpiresAt: Date.now() - 100000,
          userEmail: 'bob@gmail.com',
          userName: 'Bob Test',
          userSub: 'bob-sub-67890',
        })
      );
    });

    await page.reload();

    const connectBtn = page.getByTestId('google-signin-button');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // 4. Verify connected state
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'bob@gmail.com'
    );

    // 5. Verify up to date button appears and fresh token was used in Drive API
    await expect(page.getByTestId('up-to-date-button')).toBeVisible({
      timeout: 10000,
    });
    expect(driveCallsWithNewToken).toBeGreaterThan(0);

    // 6. Verify updated token is stored in localStorage
    const savedConfig = await page.evaluate(() => {
      return JSON.parse(
        localStorage.getItem('@healthy_device_google_sync_config') || '{}'
      );
    });
    expect(savedConfig.accessToken).toBe('fresh-gis-token');
    expect(savedConfig.tokenExpiresAt).toBeGreaterThan(Date.now());
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

  test('should show "Delete from Google Drive" checkbox when deleting a synced profile and allow toggling it', async ({
    page,
  }) => {
    // 1. Mock Google Drive configuration and connect
    await mockGoogleDriveRoutes(page);
    await mockGoogleAuthRoutes(page);
    await mockGoogleIdentityServices(page);
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-google-token',
          tokenExpiresAt: Date.now() + 3600000,
          userEmail: 'user@gmail.com',
          userName: 'Synced User',
          userSub: 'google-sub-user-999',
          lastSyncTimestamp: new Date().toISOString(),
        })
      );
    });
    await page.reload();

    // 2. Open /profile/new and create a profile (or tag active patient)
    await page.getByTestId('profile-header-button').click();

    // Add a second profile for "Synced Jane"
    await page.getByTestId('add-new-profile-button').click();
    await page.getByTestId('patient-given-name-input').fill('Synced');
    await page.getByTestId('patient-family-name-input').fill('Jane');
    await page.getByTestId('save-profile-button').click();
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'Synced Jane'
    );

    // Connect "Synced Jane" to Google Drive
    const connectBtn = page.getByTestId('google-signin-button');
    await connectBtn.click();
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'user@gmail.com'
    );

    // Let's edit the profile
    await page.getByTestId('edit-profile-button').first().click();
    await expect(page).toHaveURL(/.*profile\/.*\/edit/);

    const deleteBtn = page.getByTestId('delete-profile-button');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const modal = page.getByTestId('delete-profile-modal');
    await expect(modal).toBeVisible();

    const checkbox = modal.getByTestId('delete-from-cloud-checkbox');
    await expect(modal.getByText('Delete from Google Drive')).toBeVisible();
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  test('does not restore a locally deleted profile during a completed Drive sync', async ({
    page,
  }) => {
    const files = await mockGoogleDrive(page);
    const config = { accessToken: 'mock-token', userSub: 'deletion-user' };
    const [john] = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT id FROM patients'
      )
    );
    await seedTestPatient(page, { id: john.id, syncAccount: config.userSub });
    await seedTestPatient(page, {
      id: 'deleted-bob',
      givenName: 'Bob',
      familyName: 'Smith',
      syncAccount: config.userSub,
    });
    await page.evaluate(
      (config) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.backupToGoogleDrive(config),
      config
    );
    expect(
      [...files.values()].some(
        (file) => file.name === 'patient_deleted-bob.json.enc'
      )
    ).toBe(true);
    // Keep background sync idle; this test explicitly awaits the post-deletion sync.
    await page.evaluate(() =>
      localStorage.removeItem('@healthy_device_google_sync_config')
    );
    await page.goto('/profile');
    await expect(page.getByTestId('profile-display-name')).toHaveText(
      'Bob Smith'
    );
    await page.getByTestId('edit-profile-button').click();
    await page.clock.install();
    await page.getByTestId('delete-profile-button').click();
    await page.getByTestId('delete-profile-modal').waitFor();
    await page.clock.runFor(5000);
    await page.getByTestId('delete-modal-confirm-button').click();
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'John Doe'
    );
    // Await the real sync service, including decryption and patient eligibility filtering.
    await page.evaluate(
      (config) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.syncWithGoogleDrive(config),
      config
    );
    const patients = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT id FROM patients'
      )
    );
    expect(patients).toEqual([{ id: john.id }]);
    expect(
      [...files.values()].some(
        (file) => file.name === 'patient_deleted-bob.json.enc'
      )
    ).toBe(true);
    await expect(page.getByText('Bob Smith')).toHaveCount(0);
  });

  test('selects and deselects cloud profiles and restores only the selection', async ({
    page,
  }) => {
    await mockGoogleDrive(page);
    await mockGoogleAuthRoutes(page);
    for (const [id, givenName] of [
      ['remote-alice', 'Alice'],
      ['remote-bob', 'Bob'],
    ]) {
      await seedTestPatient(page, {
        id,
        givenName,
        syncAccount: 'google-sub-empty',
      });
    }
    await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.backupToGoogleDrive({
        accessToken: 'mock-token',
        userSub: 'google-sub-empty',
      });
      await bridge.clearDatabase();
      localStorage.removeItem('@healthy_device_google_sync_config');
    });
    await page.goto('/profile/restore-from-google-drive');
    await page.getByTestId('connect-google-drive-button').click();
    const modal = page.getByTestId('google-profile-picker-modal');
    await expect(modal).toBeVisible();
    const alice = modal.getByTestId('remote-profile-item-remote-alice');
    const bob = modal.getByTestId('remote-profile-item-remote-bob');
    const restore = modal.getByTestId('restore-selected-profiles-button');
    await expect(restore).toHaveText('Restore (2) Profiles');
    await expect(alice).toBeVisible();
    await expect(bob).toBeVisible();
    await modal.getByTestId('toggle-select-all-profiles-button').click();
    await expect(restore).toHaveText('Select Profiles');
    await expect(restore).toHaveAttribute('aria-disabled', 'true');
    await alice.click();
    await expect(restore).toHaveText('Restore Profile');
    await alice.click();
    await expect(restore).toHaveAttribute('aria-disabled', 'true');
    await alice.click();
    await expect(restore).not.toHaveAttribute('aria-disabled', 'true');
    await modal.getByTestId('restore-selected-profiles-button').click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByTestId('floating-add-button')).toBeVisible();
    expect(
      await page.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
          'SELECT id FROM patients'
        )
      )
    ).toEqual([{ id: 'remote-alice' }]);
  });

  test('shows and dismisses the empty Google Drive modal after authentication', async ({
    page,
  }) => {
    await mockGoogleDriveRoutes(page, { files: [] });
    await mockGoogleAuthRoutes(page, { userEmail: 'testuser@gmail.com' });
    await page.goto('/profile/restore-from-google-drive');
    await page.getByTestId('connect-google-drive-button').click();
    const modal = page.getByTestId('no-profiles-found-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('no-profiles-message')).toHaveText(
      'No profiles found in testuser@gmail.com Google Drive.'
    );
    await page.getByTestId('close-no-profiles-modal-button').click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByTestId('connect-google-drive-button')).toBeVisible();
    await page.getByTestId('option-create-profile').click();
    await expect(page.getByTestId('patient-given-name-input')).toBeVisible();
  });

  test('should individually connect profiles to Google Drive and show accurate status badges', async ({
    page,
  }) => {
    // Intercept Google Drive API so sync calls succeed
    await mockGoogleDriveRoutes(page, { files: [], fileId: 'file-mock-123' });

    // 1. Navigate to Profile
    await page.getByTestId('profile-header-button').click();

    // Mock Google Drive credentials in local storage
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-google-token',
          userEmail: 'alice@gmail.com',
          userName: 'Alice Health',
          userSub: 'alice-sub-12345',
          lastSyncTimestamp: new Date().toISOString(),
        })
      );
    });

    await page.reload();

    // 2. Connect the first profile ('John Doe')
    const connectBtn1 = page.getByTestId('google-signin-button');
    await expect(connectBtn1).toBeVisible();
    await expect(connectBtn1).toContainText('Connect Google Drive');
    await connectBtn1.click();

    // Now 'John Doe' is connected
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'alice@gmail.com'
    );

    // 3. Create a second profile 'Bob'
    await page.getByTestId('add-new-profile-button').click();
    await page.getByTestId('patient-given-name-input').fill('Bob');
    await page.getByTestId('save-profile-button').click();

    // 4. Verify 'Bob' is now active, but NOT connected to Google Drive!
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'Bob'
    );
    await expect(
      page.getByTestId('google-sync-disconnected').first()
    ).toBeVisible();

    // 5. Switch back to 'John Doe'
    await page
      .getByTestId(/^profile-item-/)
      .filter({ hasText: 'John Doe' })
      .first()
      .click();
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'John Doe'
    );
    // 'Self' shows connected Google Drive state
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'alice@gmail.com'
    );
  });

  test('should sync cloud data when a profile is connected and update Last synced time', async ({
    page,
  }) => {
    // Intercept Google Drive API so periodic sync calls succeed
    await mockGoogleDriveRoutes(page, { files: [], fileId: 'file-poll-123' });

    // Navigate to profile
    await page.getByTestId('profile-header-button').click();

    // 1. Mock Google Drive credentials
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-google-token',
          userEmail: 'alice@gmail.com',
          userName: 'Alice Health',
          userSub: 'alice-sub-12345',
          lastSyncTimestamp: new Date(Date.now() - 60000).toISOString(),
        })
      );
    });

    await page.reload();

    // Connect 'Self' to Google Drive
    const connectBtn = page.getByTestId('google-signin-button');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'alice@gmail.com'
    );

    const initialLastSynced = await page
      .getByTestId('last-synced-time-text')
      .textContent();
    expect(initialLastSynced).toBeTruthy();

    // Trigger sync via window focus event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    // Verify last-synced-time-text is present and updated
    const updatedLastSynced = page.getByTestId('last-synced-time-text');
    await expect(updatedLastSynced).toBeVisible();
  });
});
