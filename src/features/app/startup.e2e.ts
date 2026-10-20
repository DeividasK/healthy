import { test, expect } from '@/src/features/testing/testStorage';

test.describe('App startup', () => {
  test('shows the app header while the script loads, then the app takes over in place', async ({
    page,
  }) => {
    // Holds the app's script until the loading frame has been checked.
    let releaseScript!: () => void;
    const scriptReleased = new Promise<void>((resolve) => {
      releaseScript = resolve;
    });
    await page.route(/entry\.bundle|\/_expo\/static\/js\//, async (route) => {
      await scriptReleased;
      await route.continue();
    });

    await page.goto('/', { waitUntil: 'commit' });
    const shellLogo = page.locator('#app-shell-header svg');
    await expect(shellLogo).toBeVisible();
    await expect(shellLogo).toHaveAttribute('aria-label', 'Healthy');
    const shellBox = (await shellLogo.boundingBox())!;

    releaseScript();
    const appLogo = page.getByTestId('app-home-button').locator('svg');
    await expect(appLogo).toBeVisible();
    await expect(page.locator('#app-shell')).toHaveCount(0);
    // The app's header replaces the loading frame without the logo moving.
    const appBox = (await appLogo.boundingBox())!;
    expect(Math.abs(appBox.x - shellBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(appBox.y - shellBox.y)).toBeLessThanOrEqual(1);
    expect(appBox.width).toBeCloseTo(shellBox.width, 0);
  });

  test('shows the header and placeholder rows while the database opens', async ({
    page,
  }) => {
    // Holds the SQLite worker so the database stays closed for now.
    let releaseDatabase!: () => void;
    const databaseReleased = new Promise<void>((resolve) => {
      releaseDatabase = resolve;
    });
    await page.route(
      /expo-sqlite\/web\/worker|wa-sqlite\.wasm/,
      async (route) => {
        await databaseReleased;
        await route.continue();
      }
    );

    await page.goto('/');
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('floating-add-button')).toBeVisible();
    await expect(page.getByTestId('home-skeleton')).toBeVisible();

    releaseDatabase();
    // A fresh install has no profile yet, so Home sends the user to create one.
    await expect(page).toHaveURL(/profile\/new/);
    await expect(page.getByTestId('home-skeleton')).toHaveCount(0);
  });
});
