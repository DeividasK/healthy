import {
  test,
  expect,
  checkA11y,
  evaluateBridge as bridge,
  seedTestPatient,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('sets the clock time of each part of the day', async ({ page }) => {
    await openRoute(page, '/');
    await page.getByTestId('settings-header-button').click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId('settings-title')).toHaveText('Settings');

    // Sections start folded.
    await expect(page.getByTestId('settings-time-MORN')).toHaveCount(0);
    await page.getByTestId('settings-times-of-day-toggle').click();
    await expect(
      page.getByTestId('settings-times-of-day-toggle')
    ).toHaveAttribute('aria-expanded', 'true');

    // Defaults until changed.
    for (const [code, time] of [
      ['MORN', '08:00'],
      ['NOON', '12:00'],
      ['AFT', '15:00'],
      ['EVE', '18:00'],
      ['HS', '22:00'],
    ])
      await expect(page.getByTestId(`settings-time-${code}`)).toContainText(
        time
      );
    await checkA11y(page);

    await page.locator('#settings-time-EVE').fill('19:15');
    await page.getByTestId('save-settings-button').click();
    await expect(page).toHaveURL(/\/$/);

    // Stored per profile and captured for sync like any other record.
    await expect
      .poll(
        async () =>
          (await bridge(page, (b) => b.getProfileSettings())).timesOfDay
      )
      .toMatchObject({ MORN: '08:00', EVE: '19:15' });
    const dirty = await bridge(page, (b) =>
      b.querySql(
        "SELECT resource_type FROM sync_dirty WHERE resource_type = 'ProfileSettings';"
      )
    );
    expect(dirty).toHaveLength(1);

    // A newly opened settings screen reads the time back from the database.
    await openRoute(page, '/settings');
    await page.getByTestId('settings-times-of-day-toggle').click();
    await expect(page.getByTestId('settings-time-EVE')).toContainText('19:15');
  });
});
