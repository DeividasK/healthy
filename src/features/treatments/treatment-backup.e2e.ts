import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  seedTestPatient,
  seedTestTreatment,
  seedTestConsultation,
  connectTestSync,
  syncTestDevice,
  driveContents,
} from '@/src/features/testing/testStorage';

for (const transport of ['ZIP', 'encrypted Drive'] as const) {
  test(`${transport} preserves complete linked treatments and retains newer local data`, async ({
    page,
  }) => {
    await seedTestPatient(page, { id: 'treatment-backup-patient' });
    const consultation = await seedTestConsultation(page, {
      id: 'treatment-backup-visit',
      title: 'Backup visit',
    });
    const original = await seedTestTreatment(page, {
      id: 'backed-up-treatment',
      title: 'Treatment to back up',
      consultationId: consultation.id,
      dosageInstructions: 'First line\nSecond line',
      reason: 'Original indication',
      notes: 'Original annotation',
    });
    original.dosageInstruction[0].route = { text: 'Oral' };
    // A structured later phase and a dispense quantity travel intact.
    original.dosageInstruction.push({
      sequence: 2,
      doseAndRate: [
        {
          doseRange: {
            low: { value: 1, unit: 'tablet', code: '{tablet}' },
            high: { value: 2, unit: 'tablet', code: '{tablet}' },
          },
        },
      ],
      timing: {
        repeat: {
          frequency: 1,
          frequencyMax: 2,
          period: 1,
          periodUnit: 'd',
          when: ['EVE'],
          boundsDuration: { value: 4, unit: 'weeks', code: 'wk' },
        },
      },
    });
    original.dispenseRequest = {
      quantity: { value: 56, unit: 'tablet', code: '{tablet}' },
    };
    original.medication.concept.coding = [
      { system: 'https://example.org/medication', code: 'synthetic-code' },
    ];
    await page.evaluate(
      (request) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.saveTreatment(
          request,
          'treatment-backup-patient'
        ),
      original
    );
    let archive: number[] = [];
    if (transport === 'ZIP') {
      const download = page.waitForEvent('download');
      await page.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive()
      );
      archive = Array.from(await readFile((await (await download).path())!));
    } else {
      const { store } = await connectTestSync(page);
      expect((await syncTestDevice(page)).pushed).toBeGreaterThanOrEqual(3);
      expect(driveContents(store)).not.toContain('Treatment to back up');
    }
    // A cleared database is a new device with the same account and phrase.
    const restored = await page.evaluate(
      async ({ transport, archive }) => {
        const b = (window as any).__HEALTHY_TEST_BRIDGE__;
        await b.clearDatabase();
        if (transport === 'ZIP') await b.restoreArchive(archive);
        else await b.syncAllProfiles();
        return {
          request: await b.getTreatment('backed-up-treatment'),
          document: await b.getClinicalDocumentByConsultationId(
            'treatment-backup-visit'
          ),
        };
      },
      { transport, archive }
    );
    expect(restored.request).toEqual(original);
    expect(restored.document.section[0].entry).toContainEqual({
      reference: 'MedicationRequest/backed-up-treatment',
    });
    if (transport === 'encrypted Drive') {
      // The later edit wins on any device, whatever order chunks arrive in.
      const newer = await page.evaluate(async () => {
        const b = (window as any).__HEALTHY_TEST_BRIDGE__;
        const request = await b.getTreatment('backed-up-treatment');
        request.meta.lastUpdated = '2099-01-01T00:00:00Z';
        request.note[0].text = 'Newer local note';
        await b.saveTreatment(request, 'treatment-backup-patient');
        await b.syncNow();
        await b.clearDatabase();
        await b.syncAllProfiles();
        return await b.getTreatment('backed-up-treatment');
      });
      expect(newer.note[0].text).toBe('Newer local note');
      expect(newer.meta.lastUpdated).toBe('2099-01-01T00:00:00Z');
    }
  });
}
