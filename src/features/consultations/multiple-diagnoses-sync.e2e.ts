/// <reference types="node" />
import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  connectTestSync,
  syncTestDevice,
  driveContents,
} from '@/src/features/testing/testStorage';

test('encrypted Drive sync rebuilds diagnoses and keeps the newer Encounter', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'sync-diagnoses' });
  for (const id of ['first', 'second'])
    await seedTestCondition(page, { id, title: id });
  const original = await seedTestConsultation(page, {
    id: 'synced',
    title: 'Synced review',
    conditionIds: ['first', 'second'],
    notes: 'Full narrative',
  });
  original.reason = [
    { value: [{ reference: { reference: 'Condition/first' } }] },
  ];
  original.diagnosis[0].condition[0].concept = {
    text: 'Independent outcome',
    coding: [{ code: 'L21' }],
  };
  await page.evaluate(
    (encounter) =>
      (window as any).__HEALTHY_TEST_BRIDGE__.saveEncounter(
        encounter,
        'sync-diagnoses'
      ),
    original
  );
  const { store } = await connectTestSync(page);
  await syncTestDevice(page);
  expect(driveContents(store)).not.toContain('Full narrative');
  // A cleared database is a new device with the same account and phrase.
  const restored = await page.evaluate(async () => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    await bridge.clearDatabase();
    await bridge.syncNow();
    return {
      encounter: await bridge.getConsultation('synced'),
      links: await bridge.querySql(
        "SELECT condition_id FROM consultation_conditions WHERE consultation_id = 'synced' ORDER BY condition_id;"
      ),
    };
  });
  expect(restored.encounter).toEqual(original);
  expect(restored.links).toEqual([
    { condition_id: 'first' },
    { condition_id: 'second' },
  ]);
  const retained = await page.evaluate(async () => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    const encounter = await bridge.getConsultation('synced');
    encounter.meta.lastUpdated = '2099-01-01T00:00:00Z';
    encounter.diagnosis = [encounter.diagnosis[1]];
    encounter.priority = { text: 'newer local value' };
    await bridge.saveEncounter(encounter, 'sync-diagnoses');
    await bridge.syncNow();
    await bridge.clearDatabase();
    await bridge.syncNow();
    return {
      encounter: await bridge.getConsultation('synced'),
      links: await bridge.querySql(
        "SELECT condition_id FROM consultation_conditions WHERE consultation_id = 'synced';"
      ),
    };
  });
  expect(retained.encounter.priority.text).toBe('newer local value');
  expect(retained.encounter.meta.lastUpdated).toBe('2099-01-01T00:00:00Z');
  expect(retained.links).toEqual([{ condition_id: 'second' }]);
});
