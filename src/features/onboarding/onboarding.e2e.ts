import {
  test,
  expect,
  openRoute,
  bootstrapApp,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

test.describe('First-run onboarding', () => {
  test(
    'welcomes a new user, asks only for a name and suggests a first record',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('A device with no profile starts at Welcome', async () => {
        // Boots the app where a reset leaves it, then opens Home.
        await bootstrapApp(page);
        await bridge(page, (b) => b.navigate('/'));
        await expect(page).toHaveURL(/\/welcome$/);
        await expect(page.getByTestId('welcome-title')).toHaveText('Healthy');
        await expect(
          page.getByText('See your whole health story in one place.')
        ).toBeVisible();
        await expect(page.getByText('Private by design')).toBeVisible();
        await expect(
          page.getByText('Backup only you can unlock')
        ).toBeVisible();
        await expect(page.getByText('Yours to take anywhere')).toBeVisible();
        // Welcome's own heart stands in for the header logo.
        await expect(page.getByTestId('app-home-button')).toBeDisabled();
        await expect(page.getByTestId('profile-header-button')).toHaveCount(0);
        await expect(page.getByTestId('settings-header-button')).toHaveCount(0);
      });

      await test.step('The name step needs a name before continuing', async () => {
        await page.getByTestId('welcome-get-started').click();
        await expect(page).toHaveURL(/\/welcome\/name$/);
        await expect(page.getByTestId('welcome-name-input')).toBeFocused();
        await expect(page.getByTestId('welcome-name-continue')).toBeDisabled();
        await page.getByTestId('welcome-name-input').fill('  ');
        await expect(page.getByTestId('welcome-name-continue')).toBeDisabled();
        await page.getByTestId('welcome-name-input').fill('Jane');
        await page.getByTestId('welcome-name-continue').click();
      });

      await test.step('Home greets the user and lists what to add first', async () => {
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByTestId('start-your-record-heading')).toHaveText(
          'Hi, Jane'
        );
        const rows = page.locator('[data-testid^="start-"][role="button"]');
        await expect(rows).toHaveText([
          /Add a condition/,
          /Add a lab result/,
          /Add a medication or supplement/,
          /Log a doctor visit/,
        ]);
        await expect(page.getByTestId('floating-add-button')).toHaveCount(0);
        await expect(page.getByTestId('app-home-button')).toBeEnabled();
        await expect(page.getByTestId('profile-header-button')).toBeVisible();
        await expect(page.getByTestId('settings-header-button')).toBeVisible();
      });

      await test.step('The profile holds only the name', async () => {
        await openRoute(page, '/profile');
        await expect(page.getByTestId('profile-display-name')).toHaveText(
          'Jane'
        );
        await expect(page.getByTestId('profile-gender-value')).toHaveCount(0);
        await expect(page.getByTestId('profile-birth-date-value')).toHaveCount(
          0
        );
      });

      await test.step('Welcome is done once a profile exists', async () => {
        await bridge(page, (b) => b.navigate('/welcome'));
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByTestId('start-your-record')).toBeVisible();
      });

      await test.step('A starter row opens its form; + arrives with the first record', async () => {
        await page.getByTestId('start-condition').click();
        await expect(page).toHaveURL(/\/condition\/add$/);
        await page.getByTestId('condition-title-input').fill('Migraine');
        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByText('Migraine')).toBeVisible();
        await expect(page.getByTestId('start-your-record')).toHaveCount(0);
        await expect(page.getByTestId('floating-add-button')).toBeVisible();
      });
    }
  );

  test('a returning user restores from Welcome', async ({ page }) => {
    await openRoute(page, '/welcome');
    await page.getByTestId('welcome-restore').click();
    await expect(page).toHaveURL(/\/profile\/restore$/);
    await expect(page.getByTestId('restore-profile-title')).toHaveText(
      'Welcome back'
    );
    await expect(page.getByTestId('restore-from-google-drive')).toBeVisible();
    await expect(page.getByTestId('restore-from-file')).toBeVisible();
    await page.getByTestId('back-button').click();
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test('Welcome shows everything at once with Reduce Motion', async ({
    page,
  }) => {
    // The suite runs with Reduce Motion: nothing waits on an animation.
    await bootstrapApp(page);
    await page.getByTestId('add-profile-header-title').waitFor();
    await openRoute(page, '/welcome');
    await expect(page.getByTestId('welcome-get-started')).toBeVisible({
      timeout: 1000,
    });
    const heart = await page.getByTestId('welcome-heart').boundingBox();
    expect(heart?.width).toBe(88);
  });
});
