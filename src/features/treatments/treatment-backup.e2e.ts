import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestTreatment,
  seedTestConsultation,
  mockGoogleDrive,
} from '@/src/features/testing/testStorage';

for (const transport of ['ZIP', 'encrypted Drive'] as const) {
  test(`${transport} preserves complete linked treatments and retains newer local data`, async ({
    page,
  }) => {
    await clearAppStorage(page);
    await seedTestPatient(page, {
      id: 'treatment-backup-patient',
      syncAccount: 'synthetic-google-sub',
    });
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
    const config = {
      accessToken: 'synthetic-token',
      userSub: 'synthetic-google-sub',
    };
    let archive: number[] = [];
    if (transport === 'ZIP') {
      const download = page.waitForEvent('download');
      await page.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive()
      );
      archive = Array.from(await readFile((await (await download).path())!));
    } else {
      const files = await mockGoogleDrive(page);
      const summary = await page.evaluate(
        (config) =>
          (window as any).__HEALTHY_TEST_BRIDGE__.backupToGoogleDrive(config),
        config
      );
      expect(summary.medicationRequests).toBe(1);
      const file = Array.from(files.values()).find((file) =>
        file.name.startsWith('medicationrequest_')
      )!;
      expect(file.bytes.toString()).not.toContain('Treatment to back up');
    }
    const restored = await page.evaluate(
      async ({ transport, archive, config }) => {
        const b = (window as any).__HEALTHY_TEST_BRIDGE__;
        await b.clearDatabase();
        if (transport === 'ZIP') await b.restoreArchive(archive);
        else await b.restoreFromGoogleDrive(config);
        return {
          request: await b.getTreatment('backed-up-treatment'),
          document: await b.getClinicalDocumentByConsultationId(
            'treatment-backup-visit'
          ),
        };
      },
      { transport, archive, config }
    );
    expect(restored.request).toEqual(original);
    expect(restored.document.section[0].entry).toContainEqual({
      reference: 'MedicationRequest/backed-up-treatment',
    });
    if (transport === 'encrypted Drive') {
      const newer = await page.evaluate(async (config) => {
        const b = (window as any).__HEALTHY_TEST_BRIDGE__;
        const request = await b.getTreatment('backed-up-treatment');
        request.meta.lastUpdated = '2099-01-01T00:00:00Z';
        request.note[0].text = 'Newer local note';
        await b.saveTreatment(request, 'treatment-backup-patient');
        await b.restoreFromGoogleDrive(config);
        return await b.getTreatment('backed-up-treatment');
      }, config);
      expect(newer.note[0].text).toBe('Newer local note');
      expect(newer.meta.lastUpdated).toBe('2099-01-01T00:00:00Z');
    }
  });
}
