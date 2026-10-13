/// <reference types="node" />
import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
} from '@/src/features/testing/testStorage';

test('encrypted Drive restoration rebuilds diagnoses and retains a newer local Encounter', async ({
  page,
}) => {
  await clearAppStorage(page);
  await seedTestPatient(page, {
    id: 'sync-diagnoses',
    syncAccount: 'synthetic-google-sub',
  });
  for (const id of ['first', 'second'])
    await seedTestCondition(page, { id, title: id });
  const original = await seedTestConsultation(page, {
    id: 'synced',
    title: 'Synced review',
    conditionIds: ['first', 'second'],
    notes: 'Full narrative',
  });
  const files = new Map<
    string,
    {
      id: string;
      name: string;
      appProperties?: Record<string, string>;
      bytes: Buffer;
    }
  >();
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' || request.method() === 'PATCH') {
      const body = request.postDataBuffer()!;
      const boundary = request.headers()['content-type'].split('boundary=')[1];
      const first = body.indexOf('\r\n\r\n') + 4;
      const metadataEnd = body.indexOf(`\r\n--${boundary}`, first);
      const metadata = JSON.parse(body.subarray(first, metadataEnd).toString());
      const binaryStart = body.indexOf('\r\n\r\n', metadataEnd) + 4;
      const binaryEnd = body.lastIndexOf(`\r\n--${boundary}--`);
      const existing =
        request.method() === 'PATCH'
          ? files.get(url.pathname.split('/').pop()!)
          : undefined;
      const id = existing?.id || `file-${files.size}`;
      const record = {
        id,
        name: metadata.name || existing?.name,
        appProperties: metadata.appProperties,
        bytes: body.subarray(binaryStart, binaryEnd),
      };
      files.set(id, record);
      await route.fulfill({
        json: { id, name: record.name, appProperties: record.appProperties },
      });
    } else if (url.searchParams.get('alt') === 'media') {
      await route.fulfill({
        contentType: 'application/octet-stream',
        body: files.get(url.pathname.split('/').pop()!)!.bytes,
      });
    } else {
      await route.fulfill({
        json: {
          files: Array.from(files.values()).map(
            ({ bytes: _bytes, ...metadata }) => metadata
          ),
        },
      });
    }
  });
  const config = {
    accessToken: 'synthetic-token',
    userSub: 'synthetic-google-sub',
  };
  const backedUp = await page.evaluate(
    (configuration) =>
      (window as any).__HEALTHY_TEST_BRIDGE__.backupToGoogleDrive(
        configuration
      ),
    config
  );
  expect(backedUp.consultations).toBe(1);
  const encounterFile = Array.from(files.values()).find((file) =>
    file.name.startsWith('consultation_')
  )!;
  expect(encounterFile.bytes.toString()).not.toContain('Full narrative');
  const restored = await page.evaluate(async (configuration) => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    await bridge.clearDatabase();
    await bridge.restoreFromGoogleDrive(configuration);
    return {
      encounter: await bridge.getConsultation('synced'),
      links: await bridge.querySql(
        "SELECT condition_id FROM consultation_conditions WHERE consultation_id = 'synced' ORDER BY condition_id;"
      ),
    };
  }, config);
  expect(restored.encounter).toEqual(original);
  expect(restored.links).toEqual([
    { condition_id: 'first' },
    { condition_id: 'second' },
  ]);
  const retained = await page.evaluate(async (configuration) => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    const encounter = await bridge.getConsultation('synced');
    encounter.meta.lastUpdated = '2099-01-01T00:00:00Z';
    encounter.diagnosis = [encounter.diagnosis[1]];
    encounter.priority = { text: 'newer local value' };
    await bridge.saveEncounter(encounter, 'sync-diagnoses');
    await bridge.restoreFromGoogleDrive(configuration);
    return {
      encounter: await bridge.getConsultation('synced'),
      links: await bridge.querySql(
        "SELECT condition_id FROM consultation_conditions WHERE consultation_id = 'synced';"
      ),
    };
  }, config);
  expect(retained.encounter.priority.text).toBe('newer local value');
  expect(retained.encounter.meta.lastUpdated).toBe('2099-01-01T00:00:00Z');
  expect(retained.links).toEqual([{ condition_id: 'second' }]);
});
