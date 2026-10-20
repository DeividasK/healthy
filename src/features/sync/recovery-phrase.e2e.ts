import {
  test,
  expect,
  seedTestPatient,
  mockGoogleDrive,
  mockGoogleAuthRoutes,
  connectTestSync,
  syncTestDevice,
  driveContents,
  openSecondDevice,
  syncAllTestProfiles,
  bootstrapApp,
  openRoute,
} from '@/src/features/testing/testStorage';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

// Devices, reloads and the sync vault need pages of their own.
test.use({ freshApp: true });

const CONFIG_KEY = '@healthy_device_google_sync_config';
// A valid 24-word phrase that belongs to no vault in these tests.
const OTHER_PHRASE = `${'abandon '.repeat(23)}art`;

async function readPhrase(page: Page): Promise<string> {
  const field = page.getByTestId('recovery-phrase-value');
  await expect(field).toHaveText(/^(\S+ ){23}\S+$/);
  return (await field.textContent())!;
}

/**
 * Refocuses the window `times` times, each past the 2s focus-sync throttle,
 * on a fake clock instead of waiting in real time.
 */
async function focusPastSyncThrottle(page: Page, times: number) {
  await page.clock.install();
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.clock.fastForward(2100);
  }
  // A database round trip queues behind any sync the focus started.
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.querySql('SELECT 1;')
  );
}

test.describe('Google Drive sync with a recovery phrase', () => {
  test('sets up encrypted sync, shows the phrase and disconnects with cloud deletion', async ({
    page,
  }) => {
    const store = await mockGoogleDrive(page);
    await mockGoogleAuthRoutes(page, { userEmail: 'alice@gmail.com' });
    await seedTestPatient(page);
    await openRoute(page, '/profile');
    await page.getByTestId('google-signin-button').click();

    await expect(page).toHaveURL(/\/sync\/recovery-phrase/);
    const phrase = await readPhrase(page);
    await page.getByTestId('recovery-phrase-confirm-button').click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'alice@gmail.com'
    );
    await expect(page.getByTestId('up-to-date-button')).toBeVisible();
    const names = [...store.files.values()].map((file) => file.name);
    expect(names).toContain('vault.json');
    expect(names.some((name) => name.startsWith('chunk_'))).toBe(true);
    // Quotes never occur in encrypted (base64url) text, so a match is plaintext.
    expect(driveContents(store)).not.toContain('"family":"Doe"');

    await page.getByTestId('show-recovery-phrase-button').click();
    expect(await readPhrase(page)).toBe(phrase);
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('recovery-phrase-copy-button').click();
    await expect(
      page.getByRole('button', { name: 'Recovery phrase copied' })
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      phrase
    );
    const download = page.waitForEvent('download');
    await page.getByTestId('recovery-phrase-download-button').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('healthy-recovery-phrase.txt');
    expect(await readFile((await file.path())!, 'utf8')).toContain(phrase);
    await page.getByTestId('recovery-phrase-confirm-button').click();

    // Sync is chosen per profile: a new profile is not synced until connected.
    const chunks = () =>
      [...store.files.values()].filter((f) => f.name.startsWith('chunk_'))
        .length;
    const syncedChunks = chunks();
    await page.getByTestId('add-new-profile-button').click();
    await page.getByTestId('patient-given-name-input').fill('Bob');
    await page.getByTestId('save-profile-button').click();
    await expect(page.getByTestId('profile-display-name').first()).toHaveText(
      'Bob'
    );
    await expect(page.getByTestId('google-sync-disconnected')).toBeVisible();
    await page.getByTestId('google-signin-button').click();
    await expect(page.getByTestId('up-to-date-button')).toBeVisible();
    expect(chunks()).toBeGreaterThan(syncedChunks);

    // Disconnecting the last synced profile also leaves the account.
    for (const name of ['Bob', 'John Doe']) {
      await page
        .getByTestId(/^profile-item-/)
        .filter({ hasText: name })
        .first()
        .click();
      await page.getByTestId('disconnect-sync-button').click();
      const modal = page.getByTestId('disconnect-confirmation-modal');
      await modal.getByTestId('delete-from-cloud-checkbox').click();
      await modal.getByTestId('delete-modal-confirm-button').click();
      await expect(page.getByTestId('google-sync-disconnected')).toBeVisible();
    }
    expect(
      await page.evaluate((key) => localStorage.getItem(key), CONFIG_KEY)
    ).toBeNull();
    await expect(
      page.getByTestId('profile-display-name').first()
    ).toBeVisible();
  });

  test('restores records on another device and keeps removed profiles restorable', async ({
    page,
    browser,
  }, testInfo) => {
    await seedTestPatient(page, { id: 'alice', givenName: 'Alice' });
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);

    const { page: device, close } = await openSecondDevice(browser, testInfo);
    await mockGoogleDrive(device, store);
    await mockGoogleAuthRoutes(device);
    await device.goto('/profile/restore-from-google-drive');
    await device.getByTestId('connect-google-drive-button').click();
    await expect(device).toHaveURL(/\/sync\/restore/);

    const input = device.getByTestId('recovery-phrase-input');
    const restore = device.getByTestId('restore-vault-button');
    await input.fill('not a recovery phrase');
    await restore.click();
    await expect(
      device.getByText('That recovery phrase is not valid.', { exact: false })
    ).toBeVisible();
    await input.fill(OTHER_PHRASE);
    await restore.click();
    await expect(
      device.getByText(
        'This recovery phrase does not match the data in Google Drive.'
      )
    ).toBeVisible();
    await input.fill(phrase);
    await restore.click();
    // The new device chooses which cloud profiles to sync.
    const firstPicker = device.getByTestId('google-profile-picker-modal');
    await expect(
      firstPicker.getByTestId('remote-profile-item-alice')
    ).toContainText('Alice Doe');
    await firstPicker.getByTestId('restore-selected-profiles-button').click();
    await expect(device.getByTestId('floating-add-button')).toBeVisible();
    await device.goto('/profile');
    await expect(device.getByTestId('profile-display-name').first()).toHaveText(
      'Alice Doe'
    );

    // Deleting without the cloud option removes the profile from this device only.
    await device.getByTestId('edit-profile-button').first().click();
    await device.clock.install();
    await device.getByTestId('delete-profile-button').click();
    const modal = device.getByTestId('delete-profile-modal');
    await expect(modal.getByText('Delete from Google Drive')).toBeVisible();
    await device.clock.runFor(5000);
    await modal.getByTestId('delete-modal-confirm-button').click();
    await expect(device).toHaveURL(/\/profile\/new/);

    await device.getByTestId('option-restore-gdrive').click();
    await device.getByTestId('connect-google-drive-button').click();
    const picker = device.getByTestId('google-profile-picker-modal');
    await expect(picker.getByTestId('remote-profile-item-alice')).toContainText(
      'Alice Doe'
    );
    await picker.getByTestId('restore-selected-profiles-button').click();
    await expect(device.getByTestId('floating-add-button')).toBeVisible();
    expect(
      await device.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
          'SELECT id FROM patients'
        )
      )
    ).toEqual([{ id: 'alice' }]);
    await close();
  });

  test('starts over with a new phrase when the old one is forgotten', async ({
    page,
    browser,
  }, testInfo) => {
    await seedTestPatient(page, { id: 'alice', givenName: 'Alice' });
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);

    const { page: device, close } = await openSecondDevice(browser, testInfo);
    await mockGoogleDrive(device, store);
    await mockGoogleAuthRoutes(device);
    await seedTestPatient(device, { id: 'bob', givenName: 'Bob' });
    await device.goto('/profile');
    await device.getByTestId('google-signin-button').click();
    await expect(device).toHaveURL(/\/sync\/restore/);
    await device.clock.install();
    await device.getByTestId('forgot-recovery-phrase-button').click();
    await device.clock.runFor(5000);
    await device
      .getByTestId('start-over-modal')
      .getByTestId('delete-modal-confirm-button')
      .click();

    const newPhrase = await readPhrase(device);
    expect(newPhrase).not.toBe(phrase);
    await device.getByTestId('recovery-phrase-confirm-button').click();
    await expect(device.getByTestId('up-to-date-button')).toBeVisible();
    // The unreadable records are gone; this device's profile is uploaded again.
    expect(driveContents(store)).not.toContain(phrase);
    const restored = await openSecondDevice(browser, testInfo);
    await bootstrapApp(restored.page);
    await connectTestSync(restored.page, { store, phrase: newPhrase });
    await syncAllTestProfiles(restored.page);
    expect(
      await restored.page.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
          'SELECT id FROM patients'
        )
      )
    ).toEqual([{ id: 'bob' }]);
    // The device holding the old phrase learns that the data was reset.
    await expect(syncTestDevice(page)).rejects.toThrow('removed or reset');
    await restored.close();
    await close();
  });

  test('leaves a Google account whose phrase is not known', async ({
    page,
    browser,
  }, testInfo) => {
    await seedTestPatient(page);
    const { store } = await connectTestSync(page);

    const { page: device, close } = await openSecondDevice(browser, testInfo);
    await mockGoogleDrive(device, store);
    await mockGoogleAuthRoutes(device);
    await seedTestPatient(device);
    await device.goto('/profile');
    await device.getByTestId('google-signin-button').click();
    await expect(device).toHaveURL(/\/sync\/restore/);
    await device.getByTestId('back-button').click();
    await device.getByTestId('disconnect-locked-sync-button').click();
    await expect(
      device.getByTestId('disconnect-locked-sync-button')
    ).toHaveCount(0);
    expect(
      await device.evaluate((key) => localStorage.getItem(key), CONFIG_KEY)
    ).toBeNull();
    // Leaving never touches the other account's synced data.
    expect([...store.files.values()].some((f) => f.name === 'vault.json')).toBe(
      true
    );
    await close();
  });

  test('explains when Google Drive holds no synced records', async ({
    page,
  }) => {
    await mockGoogleDrive(page);
    await mockGoogleAuthRoutes(page, { userEmail: 'testuser@gmail.com' });
    await openRoute(page, '/profile/restore-from-google-drive');
    await page.getByTestId('connect-google-drive-button').click();
    const modal = page.getByTestId('no-profiles-found-modal');
    await expect(page.getByTestId('no-profiles-message')).toHaveText(
      'No profiles found in testuser@gmail.com Google Drive.'
    );
    await page.getByTestId('close-no-profiles-modal-button').click();
    await expect(modal).not.toBeVisible();
    // Restoring never creates a vault or keeps the Google session.
    expect(
      await page.evaluate((key) => localStorage.getItem(key), CONFIG_KEY)
    ).toBeNull();
  });

  test('an expired Google token pauses background sync until the user syncs', async ({
    page,
  }) => {
    await seedTestPatient(page);
    const { store } = await connectTestSync(page, {
      userEmail: 'bob@gmail.com',
    });
    await page.evaluate((key) => {
      const config = JSON.parse(localStorage.getItem(key)!);
      localStorage.setItem(
        key,
        JSON.stringify({
          ...config,
          accessToken: 'stale-token',
          tokenExpiresAt: Date.now() - 100000,
        })
      );
    }, CONFIG_KEY);
    store.acceptedToken = 'fresh-gis-token';
    const savedConfig = () =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        CONFIG_KEY
      );
    // Reload so sync starts with the connection made through the bridge.
    await page.goto('/profile');
    // Renewing on web needs Google's popup, which browsers block without a
    // click, so the background sync on start leaves the token alone.
    await expect(page.getByTestId('sync-now-button')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect((await savedConfig()).accessToken).toBe('stale-token');

    // Syncing by hand renews the token and catches up.
    await page.getByTestId('sync-now-button').click();
    await expect(page.getByTestId('up-to-date-button')).toBeVisible();
    const saved = await savedConfig();
    expect(saved.accessToken).toBe('fresh-gis-token');
    expect(saved.tokenExpiresAt).toBeGreaterThan(Date.now());
  });

  test('stays connected when Google rejects the session', async ({
    page,
    consoleMonitor,
  }) => {
    // Chromium logs each rejected request; the app retries on the next round.
    consoleMonitor.ignore(
      'Failed to load resource: the server responded with a status of 401',
      'Google Drive session expired'
    );
    await seedTestPatient(page);
    const { store } = await connectTestSync(page, {
      userEmail: 'bob@gmail.com',
    });
    store.acceptedToken = 'revoked-everywhere';
    const requestsBefore = store.requests.length;
    // Reload so sync starts with the connection made through the bridge.
    await page.goto('/profile');
    await expect(page.getByTestId('sync-now-button')).toBeVisible();
    await expect(page.getByTestId('connected-user-email')).toHaveText(
      'bob@gmail.com'
    );
    // The sync that runs on start is refused first.
    await expect
      .poll(() => store.requests.length)
      .toBeGreaterThan(requestsBefore);

    // Once Google refuses a token, automatic syncs stop asking for one.
    const driveRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith('https://www.googleapis.com/'))
        driveRequests.push(request.url());
    });
    await page.evaluate(() => {
      (window as any).__tokenRequests = 0;
      const oauth2 = (window as any).google.accounts.oauth2;
      const init = oauth2.initTokenClient;
      oauth2.initTokenClient = (config: any) => {
        const client = init(config);
        return {
          requestAccessToken: (options: any) => {
            (window as any).__tokenRequests++;
            client.requestAccessToken(options);
          },
        };
      };
    });
    await focusPastSyncThrottle(page, 3);
    expect(await page.evaluate(() => (window as any).__tokenRequests)).toBe(0);
    expect(driveRequests).toEqual([]);
  });

  test('does not contact Google in the background when no profile syncs', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await connectTestSync(page, { userEmail: 'bob@gmail.com' });
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        'UPDATE sync_profiles SET synced = 0;'
      )
    );
    const googleRequests: string[] = [];
    page.on('request', (request) => {
      if (/googleapis\.com|accounts\.google\.com/.test(request.url()))
        googleRequests.push(request.url());
    });
    // Reload so sync starts again with no profile marked as synced.
    await page.goto('/');
    await page.getByTestId('floating-add-button').waitFor();
    await focusPastSyncThrottle(page, 2);
    expect(googleRequests).toEqual([]);
  });
});
