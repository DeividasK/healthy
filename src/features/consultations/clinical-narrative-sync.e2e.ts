import { readFile } from 'node:fs/promises';
/// <reference types="node" />
import {
  test,
  expect,
  seedTestPatient,
  seedTestConsultation,
  getTestClinicalDocument,
  connectTestSync,
  syncTestDevice,
  restartApp,
} from '@/src/features/testing/testStorage';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

// Stamps captured changes and returns the change log's tombstones.
const deletionChanges = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const b = (window as any).__HEALTHY_TEST_BRIDGE__;
    await b.flushLocalChanges();
    return await b.querySql(
      "SELECT resource_type AS resourceType, resource_id AS id, patient_id AS patientId FROM sync_changes WHERE op = 'delete' ORDER BY resource_type"
    );
  });

test.describe('Clinical Narrative and Composition Sync', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page, { id: 'patient-narrative-test' });
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

  test('cascades deletion and records tombstones for sync', async ({
    page,
  }) => {
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

    // Both deletions are recorded for sync, the Composition via the cascade.
    expect(await deletionChanges(page)).toEqual([
      {
        resourceType: 'Composition',
        id: compId,
        patientId: 'patient-narrative-test',
      },
      {
        resourceType: 'Encounter',
        id: cons.id,
        patientId: 'patient-narrative-test',
      },
    ]);
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
    const subjectless = { ...compBefore };
    delete subjectless.subject;
    await page.evaluate(
      (doc) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.saveClinicalDocument(
          doc,
          'patient-narrative-test'
        ),
      subjectless
    );

    const downloadPromise = page.waitForEvent('download');
    const summary = await page.evaluate(async () => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive();
    });
    expect(summary.consultationCount).toBe(1);
    expect(summary.clinicalDocumentCount).toBe(1);

    const bytes = await readFile((await (await downloadPromise).path())!);
    const exportedFiles = unzipSync(bytes);
    const documentPath = `records/clinical_document_${compBefore.id}.json`;
    expect(JSON.parse(strFromU8(exportedFiles['manifest.json']))).toMatchObject(
      {
        version: 2,
        fhirVersion: '5.0.0',
        clinicalDocumentCount: 1,
      }
    );
    expect(JSON.parse(strFromU8(exportedFiles[documentPath]))).toEqual({
      resource: subjectless,
      patientId: 'patient-narrative-test',
    });
    const roundTrip = await page.evaluate(
      async ({ archive, consultationId }) => {
        const b = (window as any).__HEALTHY_TEST_BRIDGE__;
        await b.clearDatabase();
        const restored = await b.restoreArchive(archive);
        return {
          restored,
          doc: await b.getClinicalDocumentByConsultationId(consultationId),
        };
      },
      { archive: Array.from(bytes), consultationId: cons.id }
    );
    expect(roundTrip.restored.clinicalDocuments).toBe(1);
    expect(roundTrip.doc).toEqual(subjectless);

    // Existing v2 archives used raw Compositions with subject-derived ownership.
    exportedFiles[documentPath] = strToU8(JSON.stringify(compBefore));
    const legacy = await page.evaluate(
      async ({ archive, consultationId }) => {
        const b = (window as any).__HEALTHY_TEST_BRIDGE__;
        await b.clearDatabase();
        const restored = await b.restoreArchive(archive);
        return {
          restored,
          doc: await b.getClinicalDocumentByConsultationId(consultationId),
        };
      },
      { archive: Array.from(zipSync(exportedFiles)), consultationId: cons.id }
    );
    expect(legacy.restored.clinicalDocuments).toBe(1);
    expect(legacy.doc).toEqual(compBefore);

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

  test('records deletions only when they commit', async ({ page }) => {
    const cons = await seedTestConsultation(page, {
      title: 'Deletion isolation',
      notes: 'Keep me',
    });
    const comp = await getTestClinicalDocument(page, cons.id);
    const result = await page.evaluate(
      async ({ id, consultationId }) => {
        const b = (window as any).__HEALTHY_TEST_BRIDGE__;
        await b.deleteClinicalDocument(id, 'another-patient');
        await b.deleteClinicalDocument(
          'missing-document',
          'patient-narrative-test'
        );
        let rollbackError = '';
        try {
          await b.rollbackClinicalDocumentDeletion(
            id,
            'patient-narrative-test'
          );
        } catch (error) {
          rollbackError = String(error);
        }
        await b.executeSql(
          "CREATE TEMP TRIGGER prevent_document_delete BEFORE DELETE ON clinical_documents BEGIN SELECT RAISE(ABORT, 'Simulated deletion failure'); END;"
        );
        let failure = '';
        try {
          await b.deleteClinicalDocument(id, 'patient-narrative-test');
        } catch (err) {
          failure = String(err);
        } finally {
          await b.executeSql('DROP TRIGGER prevent_document_delete;');
        }
        return {
          rollbackError,
          failure,
          kept: await b.getClinicalDocumentByConsultationId(consultationId),
        };
      },
      { id: comp.id, consultationId: cons.id }
    );
    expect(result.rollbackError).toContain('Intentional deletion rollback');
    // SQLite platforms wrap trigger errors differently; the failed operation
    // and its unchanged durable state are the portable contract.
    expect(result.failure).not.toBe('');
    expect(result.kept).toEqual(comp);
    expect(await deletionChanges(page)).toEqual([]);
    await page.evaluate(
      (id) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.deleteClinicalDocument(
          id,
          'patient-narrative-test'
        ),
      comp.id
    );
    expect(await deletionChanges(page)).toEqual([
      {
        resourceType: 'Composition',
        id: comp.id,
        patientId: 'patient-narrative-test',
      },
    ]);
  });

  test('imports deletions queued by the previous sync once', async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        '@healthy_pending_deleted_clinical_resources',
        JSON.stringify([
          {
            resourceType: 'Composition',
            id: 'deleted-legacy',
            patientId: 'patient-narrative-test',
          },
        ])
      );
      localStorage.setItem(
        '@healthy_pending_deleted_consultations',
        JSON.stringify(['deleted-legacy-visit'])
      );
    });
    // The queues are imported when the app (SyncProvider) starts.
    await restartApp(page, '/');
    await expect(page.getByTestId('profile-header-button')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem('@healthy_pending_deleted_clinical_resources')
        )
      )
      .toBeNull();
    await restartApp(page, '/');
    await expect(page.getByTestId('profile-header-button')).toBeVisible();
    expect(await deletionChanges(page)).toEqual([
      {
        resourceType: 'Composition',
        id: 'deleted-legacy',
        patientId: 'patient-narrative-test',
      },
      {
        resourceType: 'Encounter',
        id: 'deleted-legacy-visit',
        patientId: null,
      },
    ]);
  });

  test('updates Notes by identity and preserves other sections and nested metadata', async ({
    page,
  }) => {
    const cons = await seedTestConsultation(page, {
      title: 'Section identity',
      notes: 'Original',
    });
    const result = await page.evaluate(async (id) => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      const doc = await b.getClinicalDocumentByConsultationId(id);
      const history = {
        title: 'History',
        text: {
          status: 'additional',
          div: '<div xmlns="http://www.w3.org/1999/xhtml">Preserve history</div>',
        },
      };
      const notes = {
        ...doc.section[0],
        title: 'Localized notes title',
        id: 'notes-section',
        author: [{ display: 'Original author' }],
        section: [history],
      };
      doc.section = [history, notes];
      await b.saveClinicalDocument(doc, 'patient-narrative-test');
      const input = {
        id,
        patientId: 'patient-narrative-test',
        title: 'Section identity',
        date: '2026-10-13',
      };
      await b.saveConsultation({ ...input, notes: 'Updated' });
      const updated = await b.getClinicalDocumentByConsultationId(id);
      await b.saveConsultation({ ...input, notes: '' });
      const cleared = await b.getClinicalDocumentByConsultationId(id);
      // A document without Notes must survive clearing Encounter notes unchanged.
      const withoutNotes = { ...cleared, section: [history] };
      await b.saveClinicalDocument(withoutNotes, 'patient-narrative-test');
      await b.saveConsultation({ ...input, notes: '' });
      const untouched = await b.getClinicalDocumentByConsultationId(id);
      await b.saveConsultation({ ...input, notes: 'New Notes' });
      const appended = await b.getClinicalDocumentByConsultationId(id);
      return {
        history,
        notes,
        updated,
        cleared,
        withoutNotes,
        untouched,
        appended,
      };
    }, cons.id);
    expect(result.updated.section[0]).toEqual(result.history);
    expect(result.updated.section[1]).toMatchObject({
      id: 'notes-section',
      title: 'Localized notes title',
      author: result.notes.author,
      section: [result.history],
    });
    expect(result.updated.section[1].text.div).toContain('Updated');
    expect(result.cleared.section[0]).toEqual(result.history);
    expect(result.cleared.section[1].text).toBeUndefined();
    expect(result.cleared.section[1].section).toEqual([result.history]);
    expect(result.untouched).toEqual(result.withoutNotes);
    expect(result.appended.section[0]).toEqual(result.history);
    expect(result.appended.section[1].text.div).toContain('New Notes');
  });

  test('syncs subjectless documents and deletes only the deleted patient everywhere', async ({
    page,
  }) => {
    const first = await seedTestConsultation(page, {
      title: 'Subjectless document',
      notes: 'Subjectless content',
    });
    await page.evaluate(async (id) => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      const doc = await b.getClinicalDocumentByConsultationId(id);
      delete doc.subject;
      await b.saveClinicalDocument(doc, 'patient-narrative-test');
    }, first.id);
    await seedTestPatient(page, { id: 'patient-other' });
    await seedTestConsultation(page, {
      title: 'Other patient',
      notes: 'Other content',
    });
    await seedTestPatient(page, { id: 'patient-default' });
    await seedTestConsultation(page, {
      title: 'Default patient',
      notes: 'Default content',
    });
    const doc = await getTestClinicalDocument(page, first.id);
    await connectTestSync(page);
    await syncTestDevice(page);
    const restored = await page.evaluate(async (id) => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      await b.clearDatabase();
      await b.syncAllProfiles();
      return {
        doc: await b.getClinicalDocumentByConsultationId(id),
        owners: await b.querySql(
          'SELECT patient_id FROM clinical_documents ORDER BY patient_id'
        ),
      };
    }, first.id);
    expect(restored.doc).toEqual(doc);
    expect(restored.owners).toEqual([
      { patient_id: 'patient-default' },
      { patient_id: 'patient-narrative-test' },
      { patient_id: 'patient-other' },
    ]);
    const afterDelete = await page.evaluate(async () => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      await b.deletePatient('patient-other');
      await b.syncNow();
      await b.clearDatabase();
      await b.syncAllProfiles();
      return await b.querySql(
        'SELECT patient_id FROM clinical_documents ORDER BY patient_id'
      );
    });
    expect(afterDelete).toEqual([
      { patient_id: 'patient-default' },
      { patient_id: 'patient-narrative-test' },
    ]);
  });
});
