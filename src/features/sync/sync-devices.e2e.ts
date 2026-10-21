import {
  test,
  expect,
  seedTestPatient,
  seedTestResources,
  connectTestSync,
  syncTestDevice,
  driveContents,
  bootstrapApp,
  openSecondDevice,
  syncAllTestProfiles,
  getBrowserLocalDate,
  seedEveryResource,
  snapshotClinicalTables,
  RECORD_SECRETS,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';
import type { Page } from '@playwright/test';

const snapshot = snapshotClinicalTables;

/** Seeds one patient with a few linked resources. */
async function seedLinkedRecord(page: Page) {
  await seedTestPatient(page, { id: 'shared-patient', givenName: 'Alice' });
  await seedTestResources(page, {
    conditions: [
      { id: 'asthma', title: 'Private asthma diagnosis' },
      { id: 'eczema', title: 'Eczema' },
    ],
    consultations: [
      {
        id: 'visit',
        title: 'Respiratory review',
        conditionIds: ['asthma'],
        reasonConditionIds: ['eczema'],
        notes: 'Confidential narrative',
        serviceProviderName: 'Private Clinic',
      },
    ],
    treatments: [
      {
        id: 'inhaler',
        title: 'Inhaler',
        consultationId: 'visit',
        reasonConditionIds: ['asthma'],
      },
    ],
    reports: [
      {
        id: 'cbc',
        serviceProviderName: 'Private Clinic',
        biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
      },
    ],
  });
  // A treatment bundle and the profile's settings replicate too.
  await bridge(page, async (b) => {
    await b.seedBundle({
      id: 'morning',
      title: 'Morning',
      times: [{ kind: 'when', code: 'MORN' }],
      memberIds: ['inhaler'],
    });
    await b.saveProfileSettings({
      timesOfDay: {
        MORN: '07:00',
        NOON: '12:00',
        AFT: '15:00',
        EVE: '18:00',
        HS: '22:00',
      },
    });
  });
}

test.describe('Sync between devices', () => {
  // One pair of devices goes through every exchange: connecting and
  // syncing them is most of what a sync test costs.
  test('two devices replicate, converge, catch up, delete and restore profiles', async ({
    page,
    browser,
  }, testInfo) => {
    test.slow();
    await seedEveryResource(page);
    await seedTestPatient(page, { id: 'second-patient', givenName: 'Bob' });
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);
    const second = await openSecondDevice(browser, testInfo);

    await test.step('Replicates every resource and keeps Drive encrypted', async () => {
      const contents = driveContents(store);
      for (const secret of RECORD_SECRETS)
        expect(contents).not.toContain(secret);
      await bootstrapApp(second.page);
      await connectTestSync(second.page, { store, phrase });
      await syncAllTestProfiles(second.page);
      expect(await snapshot(second.page)).toEqual(await snapshot(page));

      // Nothing new costs one request to the Drive changes feed.
      const before = store.requests.length;
      expect(await syncTestDevice(second.page)).toMatchObject({
        downloaded: 0,
        pushed: 0,
      });
      expect(store.requests.slice(before)).toEqual([
        { method: 'GET', path: '/drive/v3/changes' },
      ]);
    });

    await test.step('Converges concurrent edits on the later change', async () => {
      // Neither device has seen the other's edits; the second one's are later.
      const edit = async (
        b: any,
        {
          text,
          dropFirstDiagnosis,
        }: { text: string; dropFirstDiagnosis: boolean }
      ) => {
        const condition = await b.getCondition('asthma');
        condition.code.text = text;
        await b.saveCondition(condition, 'shared-patient');
        const treatment = await b.getTreatment('inhaler');
        treatment.note = [{ text }];
        await b.saveTreatment(treatment, 'shared-patient');
        const encounter = await b.getConsultation('visit');
        encounter.priority = { text };
        if (dropFirstDiagnosis) encounter.diagnosis = [encounter.diagnosis[1]];
        await b.saveEncounter(encounter, 'shared-patient');
      };
      await bridge(page, edit, {
        text: 'Edited on first device',
        dropFirstDiagnosis: false,
      });
      await bridge(second.page, edit, {
        text: 'Edited on second device',
        dropFirstDiagnosis: true,
      });
      await syncTestDevice(page);
      await syncTestDevice(second.page);
      await syncTestDevice(page);
      const converged = await snapshot(page);
      expect(await snapshot(second.page)).toEqual(converged);
      const visit = (await bridge(page, (b) =>
        b.getConsultation('visit')
      )) as any;
      expect(visit.priority.text).toBe('Edited on second device');
      // The diagnosis links are rebuilt from the winning encounter.
      expect(
        converged.consultation_conditions.filter(
          (row) => row.consultation_id === 'visit'
        )
      ).toEqual([{ consultation_id: 'visit', condition_id: 'eczema' }]);
      expect(
        (await bridge(page, (b) => b.getCondition('asthma'))) as any
      ).toMatchObject({
        code: {
          text: 'Edited on second device',
          coding: [{ code: 'L21' }, {}],
        },
      });
    });

    await test.step('A lagging or new device catches up from a compacted snapshot', async () => {
      for (const note of ['one', 'two', 'three'])
        await bridge(
          page,
          async (b, text) => {
            const condition = await b.getCondition('eczema');
            condition.note = [{ text }];
            await b.saveCondition(condition, 'shared-patient');
            await b.syncNow();
          },
          note
        );
      await bridge(page, (b) => b.compactNow());
      const [{ device_id: firstDevice }] = await bridge<
        { device_id: string }[]
      >(page, (b) => b.querySql('SELECT device_id FROM sync_device'));
      const firstDeviceFiles = [...store.files.values()].filter(
        (file) => file.appProperties?.device === firstDevice
      );
      // The first device's chunks are folded into one snapshot.
      expect(firstDeviceFiles.map((file) => file.appProperties?.kind)).toEqual([
        'snapshot',
      ]);

      expect((await syncTestDevice(second.page)).downloaded).toBe(1);
      expect(await snapshot(second.page)).toEqual(await snapshot(page));
      // A brand-new device restores everything from the snapshot as well.
      await bridge(second.page, async (b) => {
        await b.clearDatabase();
        await b.syncAllProfiles();
      });
      expect(await snapshot(second.page)).toEqual(await snapshot(page));
    });

    await test.step('Propagates deletions with their cascades', async () => {
      await bridge(page, async (b) => {
        await b.deleteCondition('eczema');
        await b.deleteServiceRequest('referral', 'shared-patient');
        // Its journal logs (Procedures) go with it.
        await b.deleteServiceRequest('meditation', 'shared-patient');
        await b.deleteReport('cbc');
        await b.deleteConsultation('visit');
        await b.syncNow();
      });
      await syncTestDevice(second.page);
      const afterDelete = await snapshot(second.page);
      expect(afterDelete).toEqual(await snapshot(page));
      expect(afterDelete.conditions).toHaveLength(1);
      expect(afterDelete.service_requests).toHaveLength(0);
      expect(afterDelete.procedures).toHaveLength(0);
      expect(afterDelete.diagnostic_reports).toHaveLength(0);
      // The treatment and the visit based on the request survive, unlinked.
      const fhir = (table: string, id: string) =>
        JSON.parse(
          (afterDelete[table].find((row) => row.id === id) as any).fhir_json
        );
      expect(fhir('medication_requests', 'inhaler')).not.toHaveProperty(
        'encounter'
      );
      expect(fhir('consultations', 'resulting-visit')).not.toHaveProperty(
        'basedOn'
      );
    });

    await test.step('Removes a profile from one device only and restores it later', async () => {
      await bridge(second.page, async (b) => {
        await b.deletePatient('shared-patient', true);
        await b.syncNow();
      });
      // The first device keeps editing the profile; the second does not get it back.
      await bridge(page, async (b) => {
        await b.seedCondition({
          patientId: 'shared-patient',
          id: 'late',
          title: 'Added later',
        });
        await b.syncNow();
      });
      await syncTestDevice(second.page);
      expect(
        await bridge(second.page, (b) =>
          b.querySql(
            "SELECT id FROM conditions WHERE patient_id = 'shared-patient'"
          )
        )
      ).toEqual([]);
      expect(
        await bridge(second.page, (b) => b.listRestorableProfiles())
      ).toEqual([{ patientId: 'shared-patient', displayName: 'Alice Doe' }]);
      expect(
        await bridge(page, (b) =>
          b.querySql("SELECT id FROM patients WHERE id = 'shared-patient'")
        )
      ).toHaveLength(1);

      await bridge(second.page, (b) => b.syncProfile('shared-patient'));
      expect(await snapshot(second.page)).toEqual(await snapshot(page));

      // Deleting everywhere removes it from the other device too, once the
      // user there confirms it.
      await bridge(page, async (b) => {
        await b.deletePatient('shared-patient');
        await b.syncNow();
      });
      await syncTestDevice(second.page);
      await bridge(second.page, (b) =>
        b.applyHeldProfileDeletion('shared-patient')
      );
      expect(await snapshot(second.page)).toEqual(await snapshot(page));
      expect((await snapshot(page)).patients).toHaveLength(1);
    });
    await second.close();
  });

  test('uploads a journal entry shortly after it is marked, without a manual sync', async ({
    page,
    browser,
  }, testInfo) => {
    await seedTestPatient(page, { id: 'shared-patient', givenName: 'Alice' });
    const started = await getBrowserLocalDate(page, -3);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'vitamin-d',
          title: 'Vitamin D',
          status: 'active',
          authoredOn: started,
          takingSince: started,
        },
      ],
    });
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);
    // Reload so sync starts with the connection made through the bridge.
    await page.goto('/journal');
    // Let the sync that runs on start finish before marking the entry.
    await page.waitForLoadState('networkidle');
    const uploads = () =>
      store.requests.filter((request) => request.method !== 'GET').length;
    const before = uploads();

    await page.getByTestId('treatment-log-taken-vitamin-d').click();
    // Saves upload about 2 s later; the next poll is a minute away.
    await expect.poll(uploads, { timeout: 15_000 }).toBeGreaterThan(before);

    const second = await openSecondDevice(browser, testInfo);
    await bootstrapApp(second.page);
    await connectTestSync(second.page, { store, phrase });
    await syncAllTestProfiles(second.page);
    expect(
      await bridge(second.page, (b) =>
        b.querySql(
          'SELECT medication_request_id FROM medication_administrations'
        )
      )
    ).toEqual([{ medication_request_id: 'vitamin-d' }]);
    await second.close();
  });

  test('rebuilds the change log for a database already marked v12 without it', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await bridge(page, async (b) => {
      // Let the upload check scheduled by the save above run first, so it
      // never reads the tables while they are being dropped.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const names = await b.querySql(
        "SELECT name, type FROM sqlite_master WHERE name LIKE 'sync_%' AND type IN ('table', 'trigger')"
      );
      for (const { name, type } of names)
        await b.executeSql(`DROP ${type.toUpperCase()} ${name}`);
      // Another schema lineage may still carry the old deletion outbox.
      await b.executeSql(
        'CREATE TABLE pending_clinical_resource_deletions (resource_type TEXT, resource_id TEXT, patient_id TEXT)'
      );
      // Nor has that lineage ever recorded running this app's repairs.
      await b.executeSql(
        "DELETE FROM app_settings WHERE key = 'schema_repairs_applied'"
      );
    });
    await page.reload();
    await expect(page.getByTestId('floating-add-button')).toBeVisible();
    const dirty = await bridge(page, (b) =>
      b.querySql('SELECT resource_type FROM sync_dirty')
    );
    expect(dirty).toEqual([{ resource_type: 'Patient' }]);
  });

  test('captures every repository write, including cascades, in the change log', async ({
    page,
  }) => {
    await seedLinkedRecord(page);
    const state = await bridge(page, async (b) => {
      await b.deleteCondition('eczema');
      await b.deleteTreatment('inhaler', 'shared-patient');
      await b.flushLocalChanges();
      const rows = await b.querySql(`
        SELECT 'Patient' AS type, id FROM patients
        UNION ALL SELECT 'Condition', id FROM conditions
        UNION ALL SELECT 'DiagnosticReport', id FROM diagnostic_reports
        UNION ALL SELECT 'Encounter', id FROM consultations
        UNION ALL SELECT 'MedicationRequest', id FROM medication_requests
        UNION ALL SELECT 'MedicationAdministration', id FROM medication_administrations
        UNION ALL SELECT 'MedicationStatement', id FROM medication_statements
        UNION ALL SELECT 'ServiceRequest', id FROM service_requests
        UNION ALL SELECT 'Procedure', id FROM procedures
        UNION ALL SELECT 'Composition', id FROM clinical_documents
        UNION ALL SELECT 'Organization', id FROM organizations
        UNION ALL SELECT 'RequestOrchestration', id FROM request_orchestrations
        UNION ALL SELECT 'ProfileSettings', id FROM profile_settings`);
      const versions = await b.querySql(
        'SELECT resource_type AS type, resource_id AS id, deleted FROM sync_row_versions'
      );
      const changes = await b.querySql(
        'SELECT resource_type AS type, resource_id AS id, op, payload FROM sync_changes'
      );
      const dirty = await b.querySql('SELECT * FROM sync_dirty');
      return { rows, versions, changes, dirty };
    });
    expect(state.dirty).toEqual([]);
    const live = state.versions.filter((v: any) => !v.deleted);
    expect(live.map((v: any) => `${v.type}/${v.id}`).sort()).toEqual(
      state.rows.map((r: any) => `${r.type}/${r.id}`).sort()
    );
    expect(
      state.versions
        .filter((v: any) => v.deleted)
        .map((v: any) => `${v.type}/${v.id}`)
        .sort()
    ).toEqual([
      'Condition/eczema',
      'MedicationRequest/inhaler',
      // Its only treatment deleted, the bundle goes with it.
      'RequestOrchestration/morning',
    ]);
    // The cascade rewrote the visit's reason, and that rewrite is what syncs.
    const visit = state.changes.find((c: any) => c.id === 'visit');
    expect(visit.payload).not.toContain('Condition/eczema');
  });
});
