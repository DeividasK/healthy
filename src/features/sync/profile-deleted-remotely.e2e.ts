import {
  test,
  expect,
  seedTestPatient,
  seedTestResources,
  connectTestSync,
  syncTestDevice,
  bootstrapApp,
  openSecondDevice,
  syncAllTestProfiles,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';
import type { Browser, Page, TestInfo } from '@playwright/test';

const CONFIG_KEY = '@healthy_device_google_sync_config';
const ALICE = { patientId: 'shared-patient', displayName: 'Alice Doe' };

const conditionIds = (page: Page) =>
  bridge(page, (b) =>
    b.querySql(
      "SELECT id FROM conditions WHERE patient_id = 'shared-patient' ORDER BY id"
    )
  );

/**
 * Syncs Alice (and optionally Bob) on two devices, then deletes Alice from
 * Google Drive on the first one and syncs the second.
 */
async function deleteFromOtherDevice(
  page: Page,
  browser: Browser,
  testInfo: TestInfo,
  {
    withSecondProfile = true,
    deletion = 'delete-profile',
  }: {
    withSecondProfile?: boolean;
    deletion?: 'delete-profile' | 'stop-syncing';
  } = {}
) {
  await seedTestPatient(page, { id: 'shared-patient', givenName: 'Alice' });
  await seedTestResources(page, {
    conditions: [
      { id: 'asthma', title: 'Asthma' },
      { id: 'eczema', title: 'Eczema' },
    ],
  });
  if (withSecondProfile)
    await seedTestPatient(page, { id: 'other-patient', givenName: 'Bob' });
  const { store, phrase } = await connectTestSync(page);
  await syncTestDevice(page);

  const second = await openSecondDevice(browser, testInfo);
  await bootstrapApp(second.page);
  await connectTestSync(second.page, { store, phrase });
  await syncAllTestProfiles(second.page);

  await bridge(
    page,
    async (b, how) => {
      if (how === 'stop-syncing')
        await b.stopSyncingProfile('shared-patient', true);
      else await b.deletePatient('shared-patient');
      await b.syncNow();
    },
    deletion
  );
  await syncTestDevice(second.page);
  return { store, phrase, second };
}

test.describe('Profile deleted from Google Drive on another device', () => {
  test('asks first, then deletes the records on request', async ({
    page,
    browser,
  }, testInfo) => {
    const { second } = await deleteFromOtherDevice(page, browser, testInfo);
    const device = second.page;

    // The deletion waits for the user: records stay and edits stay local.
    expect(await bridge(device, (b) => b.listProfileDeletionHolds())).toEqual([
      ALICE,
    ]);
    expect(await conditionIds(device)).toEqual([
      { id: 'asthma' },
      { id: 'eczema' },
    ]);
    await bridge(device, (b) =>
      b.seedCondition({ patientId: 'shared-patient', title: 'Added later' })
    );
    expect(await syncTestDevice(device)).toMatchObject({ pushed: 0 });

    await device.goto('/profile');
    const modal = device.getByTestId('profile-deleted-remotely-modal-card');
    await expect(modal).toBeVisible();
    await expect(
      modal.getByTestId('profile-deleted-remotely-message')
    ).toContainText('Alice Doe was deleted from Google Drive');
    await expect(modal.getByTestId('profile-deleted-remotely-id')).toHaveText(
      'shared-patient'
    );

    // It cannot be dismissed without a choice.
    await device.keyboard.press('Escape');
    await device.mouse.click(5, 5);
    await expect(modal).toBeVisible();
    await device.reload();
    await expect(modal).toBeVisible();

    // Deleting asks for confirmation first.
    await device.clock.install();
    await modal.getByTestId('profile-deletion-delete-button').click();
    const confirm = device.getByTestId('confirm-delete-held-profile-modal');
    await confirm.getByTestId('delete-modal-cancel-button').click();
    await expect(modal).toBeVisible();
    await modal.getByTestId('profile-deletion-delete-button').click();
    await device.clock.runFor(5000);
    await confirm.getByTestId('delete-modal-confirm-button').click();
    await expect(modal).toBeHidden();

    expect(await conditionIds(device)).toEqual([]);
    expect(
      await bridge(device, (b) => b.querySql('SELECT id FROM patients'))
    ).toEqual([{ id: 'other-patient' }]);
    expect(await bridge(device, (b) => b.listProfileDeletionHolds())).toEqual(
      []
    );
    await second.close();
  });

  test('restores the profile to Google Drive without bringing it back on the deleting device', async ({
    page,
    browser,
  }, testInfo) => {
    const { second } = await deleteFromOtherDevice(page, browser, testInfo);
    const device = second.page;

    await device.goto('/profile');
    const modal = device.getByTestId('profile-deleted-remotely-modal-card');
    await modal.getByTestId('profile-deletion-restore-button').click();
    await expect(modal).toBeHidden();

    // The deleting device can restore it, but does not get it back unasked.
    await expect
      .poll(async () => {
        await syncTestDevice(page);
        return await bridge(page, (b) => b.listRestorableProfiles());
      })
      .toEqual([ALICE]);
    expect(await conditionIds(page)).toEqual([]);
    await bridge(page, (b) => b.syncProfile('shared-patient'));
    expect(await conditionIds(page)).toEqual(await conditionIds(device));
    expect(await conditionIds(page)).toHaveLength(2);
    await second.close();
  });

  test('keeps the profile on this device only and disconnects with the last profile', async ({
    page,
    browser,
  }, testInfo) => {
    const { store, phrase, second } = await deleteFromOtherDevice(
      page,
      browser,
      testInfo,
      { withSecondProfile: false }
    );
    const device = second.page;

    await device.goto('/profile');
    const modal = device.getByTestId('profile-deleted-remotely-modal-card');
    await modal.getByTestId('profile-deletion-keep-local-button').click();
    await expect(modal).toBeHidden();
    await expect(device.getByTestId('google-sync-disconnected')).toBeVisible();
    expect(
      await device.evaluate((key) => localStorage.getItem(key), CONFIG_KEY)
    ).toBeNull();
    expect(await conditionIds(device)).toHaveLength(2);

    // Syncing it again later uploads it anew instead of deleting it.
    await connectTestSync(device, { store, phrase });
    await syncTestDevice(device);
    expect(await conditionIds(device)).toHaveLength(2);
    await syncTestDevice(page);
    expect(await bridge(page, (b) => b.listRestorableProfiles())).toEqual([
      ALICE,
    ]);
    await second.close();
  });

  test('also asks when the profile stopped syncing with its cloud copy deleted', async ({
    page,
    browser,
  }, testInfo) => {
    const { second } = await deleteFromOtherDevice(page, browser, testInfo, {
      deletion: 'stop-syncing',
    });
    expect(
      await bridge(second.page, (b) => b.listProfileDeletionHolds())
    ).toEqual([ALICE]);
    expect(await conditionIds(second.page)).toHaveLength(2);
    await second.close();
  });
});
