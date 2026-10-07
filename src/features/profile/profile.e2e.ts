import { test, expect } from '@playwright/test';
import { clearAppStorage, createConditionViaUI } from '../testing/testStorage';

test.describe('Profile Management & Patient Record Attachment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await page.reload();
  });

  test('should display profile button in header and allow navigating to profile', async ({
    page,
  }) => {
    await page.goto('/');

    const profileBtn = page.getByTestId('profile-header-button');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    await expect(page).toHaveURL(/.*profile/);
    await expect(page.getByText('Profile', { exact: true })).toBeVisible();
    await expect(page.getByTestId('active-profile-card')).toBeVisible();
    await expect(page.getByTestId('profile-display-name')).toHaveText('Self');
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
    await expect(page.getByText('New Profile')).toBeVisible();

    // 4. Fill form for new patient "Jane Doe"
    await page.getByTestId('patient-given-name-input').fill('Jane');
    await page.getByTestId('patient-family-name-input').fill('Doe');

    const genderSelect = page.getByTestId('patient-gender-select');
    if (await genderSelect.isVisible()) {
      await genderSelect.selectOption('female');
    }

    await page.getByTestId('save-profile-button').click();

    // 5. Verify back on profile screen and "Jane Doe" is active
    await expect(page.getByTestId('profile-display-name')).toHaveText(
      'Jane Doe'
    );

    // 6. Navigate to Home
    await page.getByTestId('back-button').click();
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

    // 9. Switch back to 'Self' profile
    await page.getByTestId('profile-header-button').click();
    await page.getByTestId('profile-item-patient-default').click();

    // Verify 'Self' is now active
    await expect(page.getByTestId('profile-display-name')).toHaveText('Self');

    // 10. Return to Home -> 'Back Pain' should be visible, 'Asthma' should not
    await page.getByTestId('back-button').click();
    await expect(page.getByText('Back Pain')).toBeVisible();
    await expect(page.getByText('Asthma')).not.toBeVisible();
  });

  test('should allow editing an existing profile', async ({ page }) => {
    await page.goto('/profile');

    // Click edit on active profile
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
    await page.goto('/profile');

    // 1. Verify Google Drive Sync Card is visible in disconnected state
    const syncCard = page.getByTestId('google-sync-card');
    await expect(syncCard).toBeVisible();
    await expect(page.getByText('Cloud Backup')).toBeVisible();

    const googleBtn = page.getByTestId('google-signin-button');
    await expect(googleBtn).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();

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

    // 3. Verify connected state
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'alice@gmail.com'
    );
    await expect(page.getByTestId('up-to-date-button')).toBeVisible();
    await expect(page.getByTestId('last-synced-time-text')).toBeVisible();

    // 4. Verify Transfer Action buttons exist
    await expect(page.getByTestId('export-zip-button')).toBeVisible();
    await expect(page.getByTestId('restore-zip-button')).toBeVisible();

    // 5. Test Export Zip button
    await page.getByTestId('export-zip-button').click();
    await expect(page.getByTestId('sync-feedback-toast')).toBeVisible();

    // 6. Test Disconnect
    const disconnectBtn = page.getByTestId('disconnect-sync-button');
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Verify disconnected state restored
    await expect(page.getByTestId('google-signin-button')).toBeVisible();
  });

  test('should display top header sync warning and modal explanation when sync error occurs', async ({
    page,
  }) => {
    // Intercept Google Drive API to simulate a network/token error during sync
    await page.route('https://www.googleapis.com/**', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
      });
    });

    // Set connected state with expired last sync so sync-now-button is visible
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

    await page.goto('/profile');
    await page.reload();

    // Trigger Sync Now
    await page.getByTestId('sync-now-button').click();

    // Verify GoogleSyncCard shows Reconnect Google button
    await expect(page.getByTestId('reconnect-google-button')).toBeVisible();

    // Navigate to Home to inspect top header
    await page.getByTestId('back-button').click();

    // Top header should show persistent yellow warning icon
    const warningIcon = page.getByTestId('sync-warning-icon');
    await expect(warningIcon).toBeVisible();

    // Click warning icon to open error modal
    await warningIcon.click();
    const errorModal = page.getByTestId('sync-error-modal');
    await expect(errorModal).toBeVisible();
    await expect(page.getByTestId('sync-error-message')).toContainText(
      'session has expired'
    );
    await expect(page.getByTestId('reconnect-sync-btn')).toBeVisible();

    // Dismiss error modal
    await page.getByTestId('dismiss-sync-error-btn').click();
    await expect(errorModal).not.toBeVisible();
  });
});
