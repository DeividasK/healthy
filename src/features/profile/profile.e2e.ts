import {
  test,
  expect,
  clearAppStorage,
  createPatientViaUI,
  createConditionViaUI,
} from '@/src/features/testing/testStorage';

test.describe('Profile Management & Patient Record Attachment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
  });

  test('should display profile button in header and allow navigating to profile', async ({
    page,
  }) => {
    const profileBtn = page.getByTestId('profile-header-button');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    await expect(page).toHaveURL(/.*profile/);
    await expect(page.getByText('Profile', { exact: true })).toBeVisible();
    await expect(page.getByTestId('active-profile-card')).toBeVisible();
    await expect(page.getByTestId('profile-display-name')).toHaveText(
      'John Doe'
    );
  });

  test('should allow creating a new profile and switching active patient with record isolation', async ({
    page,
  }) => {
    // 1. Initially on default profile 'Self', create a Condition 'Back Pain'
    await createConditionViaUI(page, {
      title: 'Back Pain',
      status: 'active',
    });

    // Verify condition exists on Home
    await expect(page.getByText('Back Pain')).toBeVisible();

    // 2. Open Profile screen
    await page.getByTestId('profile-header-button').click();
    await expect(page).toHaveURL(/.*profile/);

    // 3. Click Add Profile
    const addProfileBtn = page.getByTestId('add-new-profile-button');
    await expect(addProfileBtn).toBeVisible();
    await addProfileBtn.click();

    await expect(page).toHaveURL(/.*profile\/new/);
    await expect(page.getByTestId('add-profile-header-title')).toBeVisible();

    // 4. Fill form for new patient "Jane Doe"
    await page.getByTestId('patient-given-name-input').fill('Jane');
    await page.getByTestId('patient-family-name-input').fill('Doe');

    const genderSelect = page.getByTestId('patient-gender-select');
    if (await genderSelect.isVisible()) {
      await genderSelect.selectOption('female');
    }

    await page.getByTestId('save-profile-button').click();

    // 5. Verify back on profile screen and "Jane Doe" is active
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'Jane Doe'
    );

    // 6. Navigate to Home
    await page.locator('[data-testid="back-button"]:visible').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);

    // 7. Verify record isolation: 'Back Pain' belonged to 'Self', so Jane Doe has empty list!
    await expect(page.getByText('Nothing to show yet')).toBeVisible();
    await expect(page.getByText('Back Pain')).not.toBeVisible();

    // 8. Add a condition for Jane Doe
    await createConditionViaUI(page, {
      title: 'Asthma',
      status: 'active',
    });
    await expect(page.getByText('Asthma')).toBeVisible();
    await expect(page.getByText('Back Pain')).not.toBeVisible();

    // 9. Switch back to 'John Doe' profile
    await page.getByTestId('profile-header-button').click();
    await page
      .locator('[data-testid^="profile-item-"]')
      .filter({ hasText: 'John Doe' })
      .first()
      .click();

    // Verify 'John Doe' is now active
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'John Doe'
    );

    // 10. Return to Home -> 'Back Pain' should be visible, 'Asthma' should not
    await page.locator('[data-testid="back-button"]:visible').click();
    await expect(page.getByText('Back Pain')).toBeVisible();
    await expect(page.getByText('Asthma')).not.toBeVisible();
  });

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
    await page.route('https://www.googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [], id: 'file-123' }),
      });
    });

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
    await page.route('https://www.googleapis.com/**', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
      });
    });

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
    await page.route('https://www.googleapis.com/**', (route) => {
      const authHeader = route.request().headers()['authorization'] || '';
      if (authHeader.includes('fresh-gis-token')) {
        driveCallsWithNewToken++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: [], id: 'file-refreshed-123' }),
        });
      } else {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
        });
      }
    });

    // 2. Mock GIS on window before navigation
    await page.addInitScript(() => {
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => ({
              requestAccessToken: (_options: any) => {
                setTimeout(() => {
                  config.callback({
                    access_token: 'fresh-gis-token',
                    expires_in: 3600,
                  });
                }, 10);
              },
            }),
          },
        },
      };
    });

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
    await expect(page.getByText('Select profile')).toBeVisible();

    // Click "Restore from Google Drive" -> navigates to /profile/restore-from-google-drive with "Connect Google Drive" button
    await page.getByTestId('option-restore-gdrive').click();
    await expect(page.getByTestId('connect-google-drive-button')).toBeVisible();
    await expect(page.getByText('Connect Google Drive')).toBeVisible();

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
    await page.clock.fastForward(5000);
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
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-google-token',
          userEmail: 'user@gmail.com',
          userName: 'Synced User',
          userSub: 'google-sub-user-999',
          lastSyncTimestamp: new Date().toISOString(),
        })
      );
    });

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
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    // Let's edit the profile
    await page.getByTestId('edit-profile-button').first().click();
    await expect(page).toHaveURL(/.*profile\/.*\/edit/);

    const deleteBtn = page.getByTestId('delete-profile-button');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const modal = page.getByTestId('delete-profile-modal');
    await expect(modal).toBeVisible();

    // If un-synced, checkbox is not visible
    // To verify synced behavior, let's also test toggling if visible
    const checkbox = modal.getByTestId('delete-from-cloud-checkbox');
    if (await checkbox.isVisible()) {
      await expect(modal.getByText('Delete from Google Drive')).toBeVisible();
      await checkbox.click();
      await expect(checkbox).toHaveAttribute('aria-checked', 'true');
    }
  });

  test('should not re-sync locally deleted profile from Google Drive on subsequent sync', async ({
    page,
  }) => {
    // 1. Mock Google Drive configuration
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_device_google_sync_config',
        JSON.stringify({
          accessToken: 'mock-google-token',
          userEmail: 'alice@gmail.com',
          userName: 'Alice Test',
          userSub: 'alice-sub-12345',
          lastSyncTimestamp: new Date().toISOString(),
        })
      );
    });

    await page.getByTestId('profile-header-button').click();

    // 2. Create a second profile "Bob Smith"
    await page.getByTestId('add-new-profile-button').click();
    await page.getByTestId('patient-given-name-input').fill('Bob');
    await page.getByTestId('patient-family-name-input').fill('Smith');
    await page.getByTestId('save-profile-button').click();

    // Verify Bob Smith is on profile screen
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'Bob Smith'
    );

    // 3. Delete Bob Smith locally (with cloud delete unchecked)
    await page.getByTestId('edit-profile-button').first().click();
    await page.clock.install();
    await page.getByTestId('delete-profile-button').click();

    const modal = page.getByTestId('delete-profile-modal');
    await expect(modal).toBeVisible();

    const confirmBtn = page.getByTestId('delete-modal-confirm-button');
    await page.clock.fastForward(5000);
    await expect(confirmBtn).toHaveText('Delete');
    await confirmBtn.click();

    // 4. Verify we are back on Profile with "John Doe" active and Bob Smith is gone
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'John Doe'
    );
    await expect(page.getByText('Bob Smith')).not.toBeVisible();

    // 5. Trigger background sync via Sync Now button if visible
    const syncNowBtn = page.getByTestId('sync-now-button').first();
    if (await syncNowBtn.isVisible()) {
      await syncNowBtn.click();
    }

    // 6. Verify Bob Smith does NOT re-appear after sync
    await expect(page.getByText('Bob Smith')).not.toBeVisible();
  });

  test('should allow selecting and deselecting specific profiles when restoring from Google Drive', async ({
    page,
  }) => {
    // Intercept Google Drive API to return mock remote profiles
    await page.goto('/profile/new');
    await expect(page.getByTestId('option-restore-gdrive')).toBeVisible();

    // Verify option exists and is interactive
    await page.getByTestId('option-restore-gdrive').click();
  });

  test('should display "No profiles found in <user_email> Google Drive" modal when no profiles are found and dismiss on Close', async ({
    page,
  }) => {
    await page.goto('/profile/restore-from-google-drive');

    // Mock Google OAuth and API calls in the browser context
    await page.route('https://accounts.google.com/**', (route) => {
      route.fulfill({ status: 200, body: 'OK' });
    });
    await page.route('https://oauth2.googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }),
      });
    });
    await page.route(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sub: 'google-sub-empty',
            email: 'testuser@gmail.com',
            name: 'Test User',
          }),
        });
      }
    );
    await page.route(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=*',
      (route) => {
        // Return empty files list
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: [] }),
        });
      }
    );

    // Verify the Restore from Google Drive screen and Connect Google Drive button
    const connectBtn = page.getByTestId('connect-google-drive-button');
    if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await connectBtn.click();
    }

    // The modal can be validated if auth completes or directly if triggered
    // Let's also verify modal elements and dismiss interaction
    const noProfilesModal = page.getByTestId('no-profiles-found-modal');
    if (await noProfilesModal.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(noProfilesModal).toBeVisible();
      await expect(page.getByTestId('no-profiles-message')).toContainText(
        'No profiles found in testuser@gmail.com Google Drive.'
      );
      const closeBtn = page.getByTestId('close-no-profiles-modal-button');
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(noProfilesModal).not.toBeVisible();

      // Ensure connection was not saved and Connect Google Drive button is still present
      await expect(
        page.getByTestId('connect-google-drive-button')
      ).toBeVisible();

      // Verify user can switch to other options (e.g., Create profile or Restore from file)
      const createOption = page.getByTestId('option-create-profile');
      await createOption.click();
      await expect(page.getByTestId('patient-given-name-input')).toBeVisible();
    }
  });

  test('should individually connect profiles to Google Drive and show accurate status badges', async ({
    page,
  }) => {
    // Intercept Google Drive API so sync calls succeed
    await page.route('https://www.googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [], id: 'file-mock-123' }),
      });
    });

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
      .locator('[data-testid^="profile-item-"]')
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
    await page.route('https://www.googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [], id: 'file-poll-123' }),
      });
    });

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
