import {
  test,
  expect,
  createPatientViaUI,
} from '@/src/features/testing/testStorage';
import { mockGoogleIdentityServices } from '@/src/features/testing/mockGoogleDrive';

// Other tabs share the page's storage, so it needs a page of its own.
test.use({ freshApp: true });

test.describe('Database open in another tab', () => {
  test('a second tab waits for the first instead of crashing', async ({
    page,
  }) => {
    await createPatientViaUI(page);

    const secondTab = await page.context().newPage();
    await mockGoogleIdentityServices(secondTab);
    await secondTab.goto('/');
    await expect(
      secondTab.getByText('Healthy is already open in another tab')
    ).toBeVisible();
    await expect(secondTab.getByText('Something went wrong')).toHaveCount(0);

    // Retrying while the first tab is still open keeps the message.
    await secondTab.getByTestId('database-in-use-retry').click();
    await expect(secondTab.getByTestId('database-in-use')).toBeVisible();

    // Once the first tab closes, the second opens the same database.
    await page.close();
    await expect(secondTab.getByTestId('database-in-use')).toHaveCount(0);
    await expect(secondTab.getByTestId('floating-add-button')).toBeVisible();
    await secondTab.goto('/profile');
    await expect(secondTab.getByTestId('profile-display-name')).toHaveText(
      'John Doe'
    );
  });
});
