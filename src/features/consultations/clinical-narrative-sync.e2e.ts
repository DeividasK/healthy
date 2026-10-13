import { mockGoogleDrive } from '@/src/features/testing/mockGoogleDrive';
/// <reference types="node" />
import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestConsultation,
  getTestClinicalDocument,
} from '@/src/features/testing/testStorage';
import { zipSync, strToU8 } from 'fflate';

test.describe('Clinical Narrative and Composition Sync', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page, {
      id: 'patient-narrative-test',
      syncAccount: 'narrative-user-sub',
    });
  });

  test('creates, updates and removes Composition alongside Encounter notes', async ({
    page,
  }) => {
    // 1. Create consultation with notes
    const cons = await seedTestConsultation(page, {
      id: 'cons-narrative-1',
      title: 'General Checkup',
      doctorName: 'Dr. Leonard McCoy',
      date: '2026-10-13',
      notes: 'Patient reported mild headache.\nVitals normal.',
      status: 'completed',
    });

    const comp = await getTestClinicalDocument(page, cons.id);
    expect(comp).not.toBeNull();
    expect(comp.resourceType).toBe('Composition');
    expect(comp.status).toBe('final');
    expect(comp.encounter?.reference).toBe(`Encounter/${cons.id}`);
    expect(comp.subject?.[0]?.reference).toBe('Patient/patient-narrative-test');
    expect(comp.author?.[0]?.display).toBe('Dr. Leonard McCoy');
    expect(comp.section?.[0]?.title).toBe('Notes');
    expect(comp.section?.[0]?.text?.div).toContain('mild headache');
    expect(comp.section?.[0]?.text?.div).toContain('Vitals normal.');

    // 2. Update notes
    await page.evaluate(async (consultationId) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.saveConsultation({
        id: consultationId,
        patientId: 'patient-narrative-test',
        title: 'General Checkup',
        doctorName: 'Dr. Leonard McCoy',
        date: '2026-10-13',
        notes: 'Updated notes: headache resolved.',
        status: 'completed',
      });
    }, cons.id);

    const updatedComp = await getTestClinicalDocument(page, cons.id);
    expect(updatedComp).not.toBeNull();
    expect(updatedComp.section?.[0]?.text?.div).toContain('headache resolved');
    expect(updatedComp.section?.[0]?.text?.div).not.toContain('mild headache');

    // 3. Clear notes removes the empty Composition
    await page.evaluate(async (consultationId) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.saveConsultation({
        id: consultationId,
        patientId: 'patient-narrative-test',
        title: 'General Checkup',
        doctorName: 'Dr. Leonard McCoy',
        date: '2026-10-13',
        notes: '',
        status: 'completed',
      });
    }, cons.id);

    const clearedComp = await getTestClinicalDocument(page, cons.id);
    expect(clearedComp).toBeNull();
  });

  test('cascades deletion and records tombstone for sync', async ({ page }) => {
    const cons = await seedTestConsultation(page, {
      id: 'cons-delete-cascade',
      title: 'Consultation to Delete',
      doctorName: 'Dr. Julian Bashir',
      date: '2026-10-13',
      notes: 'Initial clinical notes.',
      status: 'completed',
    });

    const comp = await getTestClinicalDocument(page, cons.id);
    expect(comp).not.toBeNull();
    const compId = comp.id;

    // Delete consultation
    await page.evaluate(async (consultationId) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.deleteConsultation(consultationId);
    }, cons.id);

    // Verify consultation and composition deleted from SQLite
    const remainingCons = await page.evaluate(async (consultationId) => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.getConsultation(
        consultationId
      );
    }, cons.id);
    expect(remainingCons).toBeNull();

    const remainingComp = await getTestClinicalDocument(page, cons.id);
    expect(remainingComp).toBeNull();

    // Verify clinical tombstone recorded
    const rawTombstones = await page.evaluate(async () => {
      return await localStorage.getItem(
        '@healthy_pending_deleted_clinical_resources'
      );
    });
    expect(rawTombstones).not.toBeNull();
    const tombstones = JSON.parse(rawTombstones!);
    const matching = tombstones.find(
      (t: any) => t.resourceType === 'Composition' && t.id === compId
    );
    expect(matching).toBeDefined();
    expect(matching.patientId).toBe('patient-narrative-test');
  });

  test('ZIP archive v2 export and import round-trips Composition and manifest v2', async ({
    page,
  }) => {
    const cons = await seedTestConsultation(page, {
      id: 'cons-zip-test',
      title: 'Archive Consultation',
      doctorName: 'Dr. Beverly Crusher',
      date: '2026-10-13',
      notes: 'Archive note content.',
      status: 'completed',
    });

    const compBefore = await getTestClinicalDocument(page, cons.id);
    expect(compBefore).not.toBeNull();

    // Export archive via test bridge
    const summary = await page.evaluate(async () => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive();
    });
    expect(summary.consultationCount).toBe(1);
    expect(summary.clinicalDocumentCount).toBe(1);

    // Re-read exported zip bytes from bridge
    const exportResult = await page.evaluate(async (docId) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      // Fetch stored documents
      const docs = await bridge.querySql(
        'SELECT fhir_json FROM clinical_documents WHERE id = ?',
        [docId]
      );
      return docs;
    }, compBefore.id);
    expect(exportResult.length).toBe(1);

    // Test restoring from a v1 archive (backward compatibility)
    const v1ZipFiles: Record<string, Uint8Array> = {
      'manifest.json': strToU8(
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          patientCount: 1,
          reportCount: 0,
          conditionCount: 0,
          consultationCount: 1,
        })
      ),
      'records/patient_p1.json': strToU8(
        JSON.stringify({
          resourceType: 'Patient',
          id: 'p1',
          name: [{ given: ['Jane'], family: 'Doe' }],
        })
      ),
      'records/consultation_c1.json': strToU8(
        JSON.stringify({
          resourceType: 'Encounter',
          id: 'c1',
          status: 'completed',
          subject: { reference: 'Patient/p1' },
          type: [{ text: 'Legacy Consultation' }],
        })
      ),
    };
    const v1ZipBytes = zipSync(v1ZipFiles);

    const v1Restore = await page.evaluate(async (bytesArray) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.clearDatabase();
      return await bridge.restoreArchive(bytesArray);
    }, Array.from(v1ZipBytes));

    expect(v1Restore.patients).toBe(1);
    expect(v1Restore.consultations).toBe(1);
    expect(v1Restore.clinicalDocuments).toBe(0);
  });

  test('encrypted Google Drive sync backs up and restores Composition', async ({
    page,
  }) => {
    const cons = await seedTestConsultation(page, {
      id: 'cons-drive-sync',
      title: 'Synced Visit',
      doctorName: 'Dr. Beverly Crusher',
      date: '2026-10-13',
      notes: 'Drive sync note.',
      status: 'completed',
    });

    const comp = await getTestClinicalDocument(page, cons.id);
    expect(comp).not.toBeNull();

    const files = await mockGoogleDrive(page);
    const config = {
      accessToken: 'test-token',
      userSub: 'narrative-user-sub',
    };

    // Backup to Google Drive
    const backupResult = await page.evaluate(
      (conf) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.backupToGoogleDrive(conf),
      config
    );
    expect(backupResult.consultations).toBe(1);
    expect(backupResult.clinicalDocuments).toBe(1);

    // Verify composition file was encrypted in Drive
    const compFile = Array.from(files.values()).find((f) =>
      f.name.startsWith('composition_')
    );
    expect(compFile).toBeDefined();
    expect(compFile!.bytes.toString()).not.toContain('Drive sync note.');

    // Clear local database and restore
    const restoreResult = await page.evaluate(async (conf) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.clearDatabase();
      const restored = await bridge.restoreFromGoogleDrive(conf);
      const restoredComp =
        await bridge.getClinicalDocumentByConsultationId('cons-drive-sync');
      return { restored, restoredComp };
    }, config);

    expect(restoreResult.restored.consultations).toBe(1);
    expect(restoreResult.restored.clinicalDocuments).toBe(1);
    expect(restoreResult.restoredComp).not.toBeNull();
    expect(restoreResult.restoredComp.section[0].text.div).toContain(
      'Drive sync note.'
    );
  });
});
