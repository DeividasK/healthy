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
    await page.getByTestId('save-profile-button').click();

    await expect(page.getByTestId('profile-display-name')).toHaveText(
      'John Smith'
    );
  });
});
