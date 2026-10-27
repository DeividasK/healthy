import {
  test,
  expect,
  checkA11y,
  evaluateBridge as bridge,
  seedTestPatient,
  seedTestReport,
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

    await page.reload();
    await page.getByTestId('settings-header-button').click();
    await page.getByTestId('settings-times-of-day-toggle').click();
    await expect(page.getByTestId('settings-time-EVE')).toContainText('19:15');
  });

  test('picks the region whose biomarker ranges apply', async ({ page }) => {
    // Above the International high of 5.1, inside Australia's 5.2.
    await seedTestReport(page, {
      date: '2026-10-01',
      biomarkers: [{ name: 'Potassium', value: 5.15, unit: 'mmol/L' }],
    });
    await openRoute(page, '/biomarker/2823-3');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'Out of range'
    );
    await expect(page.getByTestId('biomarker-range-region')).toHaveText(
      'This range is used for every region. Change region'
    );

    await page.getByTestId('biomarker-range-region-change').click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByTestId('settings-ranges-toggle').click();
    // The device's region until one is picked (the browser is en-US).
    await expect(page.getByTestId('settings-range-region')).toHaveValue('us');
    await expect(
      page.getByTestId('settings-range-region-explanation')
    ).toContainText('We picked United States from your device.');
    await expect(page.getByTestId('settings-range-region-bodies')).toHaveText(
      'Uses the general ranges for every biomarker.'
    );
    await checkA11y(page);

    await page.getByTestId('settings-range-region').selectOption('anz');
    await expect(page.getByTestId('settings-range-region-bodies')).toHaveText(
      'Uses its own ranges for 17 biomarkers, from AACB/RCPA harmonised reference intervals. Others use the general ranges.'
    );
    await page.getByTestId('save-settings-button').click();
    await expect
      .poll(
        async () =>
          (await bridge(page, (b) => b.getProfileSettings())).rangeRegion
      )
      .toBe('anz');

    await openRoute(page, '/biomarker/2823-3');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'In range'
    );
    await expect(page.getByTestId('biomarker-range-region')).toHaveText(
      'Australia and New Zealand range, from AACB/RCPA harmonised reference intervals (2016). Change region'
    );
    await expect(page.getByTestId('biomarker-latest-range-limit')).toHaveText([
      '3.5',
      '5.2',
    ]);
  });
});
