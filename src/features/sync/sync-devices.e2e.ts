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
} from '@/src/features/testing/testStorage';
import type { Page } from '@playwright/test';

const bridge = <T>(
  page: Page,
  run: (b: any, arg: any) => Promise<T>,
  arg?: unknown
): Promise<T> =>
  page.evaluate(
    ({ source, arg }) =>
      new Function('b', 'arg', `return (${source})(b, arg);`)(
        (window as any).__HEALTHY_TEST_BRIDGE__,
        arg
      ),
    { source: run.toString(), arg }
  );

const CLINICAL_TABLES = [
  'patients',
  'conditions',
  'diagnostic_reports',
  'observations',
  'consultations',
  'consultation_conditions',
  'clinical_documents',
  'medication_requests',
];

/** Every canonical row on a device, for comparing two devices. */
const snapshot = (page: Page) =>
  bridge(
    page,
    async (b, tables: string[]) => {
      const result: Record<string, unknown[]> = {};
      for (const table of tables)
        result[table] = await b.querySql(
          table === 'consultation_conditions'
            ? `SELECT * FROM ${table} ORDER BY consultation_id, condition_id`
            : `SELECT id, fhir_json FROM ${table} ORDER BY id`
        );
      return result;
    },
    CLINICAL_TABLES
  );

/** Seeds one patient with every resource type, linked to each other. */
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
        biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
      },
    ],
  });
}

test.describe('Sync between devices', () => {
  test('replicates every resource, keeps Drive encrypted and propagates deletions', async ({
    page,
    browser,
  }, testInfo) => {
    await seedLinkedRecord(page);
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);
    const contents = driveContents(store);
    for (const secret of [
      'Private asthma diagnosis',
      'Confidential narrative',
      'Alice',
    ])
      expect(contents).not.toContain(secret);

    const second = await openSecondDevice(browser, testInfo);
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

    // Deletions (including their cascades) reach the other device.
    await bridge(page, async (b) => {
      await b.deleteCondition('asthma');
      await b.deleteReport('cbc');
      await b.deleteConsultation('visit');
      await b.syncNow();
    });
    await syncTestDevice(second.page);
    const afterDelete = await snapshot(second.page);
    expect(afterDelete).toEqual(await snapshot(page));
    expect(afterDelete.conditions).toHaveLength(1);
    expect(afterDelete.diagnostic_reports).toHaveLength(0);
    expect(afterDelete.clinical_documents).toHaveLength(0);
    // The treatment survives with its links cleared on both devices.
    expect(
      JSON.parse((afterDelete.medication_requests[0] as any).fhir_json)
    ).not.toHaveProperty('encounter');
    await second.close();
  });

  test('converges concurrent edits on the later change', async ({
    page,
    browser,
  }, testInfo) => {
    await seedLinkedRecord(page);
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);
    const second = await openSecondDevice(browser, testInfo);
    await bootstrapApp(second.page);
    await connectTestSync(second.page, { store, phrase });
    await syncAllTestProfiles(second.page);

    const rename = (title: string) => async (b: any, t: string) => {
      const condition = await b.getCondition('eczema');
      condition.code.text = t;
      await b.saveCondition(condition, 'shared-patient');
    };
    // Neither device has seen the other's edit; the second one is later.
    await bridge(page, rename('first'), 'Edited on first device');
    await bridge(second.page, rename('second'), 'Edited on second device');
    await syncTestDevice(page);
    await syncTestDevice(second.page);
    await syncTestDevice(page);
    for (const device of [page, second.page])
      expect(
        (await bridge(device, (b) => b.getCondition('eczema'))) as any
      ).toMatchObject({ code: { text: 'Edited on second device' } });
    await second.close();
  });

  test('a lagging or new device catches up from a compacted snapshot', async ({
    page,
    browser,
  }, testInfo) => {
    await seedLinkedRecord(page);
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);
    const second = await openSecondDevice(browser, testInfo);
    await bootstrapApp(second.page);
    await connectTestSync(second.page, { store, phrase });
    await syncAllTestProfiles(second.page);

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
    const [{ device_id: firstDevice }] = await bridge<{ device_id: string }[]>(
      page,
      (b) => b.querySql('SELECT device_id FROM sync_device')
    );
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
    await second.close();
  });

  test('removes a profile from one device only and restores it later', async ({
    page,
    browser,
  }, testInfo) => {
    await seedLinkedRecord(page);
    await seedTestPatient(page, { id: 'second-patient', givenName: 'Bob' });
    const { store, phrase } = await connectTestSync(page);
    await syncTestDevice(page);
    const second = await openSecondDevice(browser, testInfo);
    await bootstrapApp(second.page);
    await connectTestSync(second.page, { store, phrase });
    await syncAllTestProfiles(second.page);

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

    // Deleting everywhere removes it from the other device too.
    await bridge(page, async (b) => {
      await b.deletePatient('shared-patient');
      await b.syncNow();
    });
    await syncTestDevice(second.page);
    expect(await snapshot(second.page)).toEqual(await snapshot(page));
    expect((await snapshot(page)).patients).toHaveLength(1);
    await second.close();
  });

  test('rebuilds the change log for a database already marked v12 without it', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await bridge(page, async (b) => {
      const names = await b.querySql(
        "SELECT name, type FROM sqlite_master WHERE name LIKE 'sync_%' AND type IN ('table', 'trigger')"
      );
      for (const { name, type } of names)
        await b.executeSql(`DROP ${type.toUpperCase()} ${name}`);
      // Another schema lineage may still carry the old deletion outbox.
      await b.executeSql(
        'CREATE TABLE pending_clinical_resource_deletions (resource_type TEXT, resource_id TEXT, patient_id TEXT)'
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
        UNION ALL SELECT 'Composition', id FROM clinical_documents`);
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
    ).toEqual(['Condition/eczema', 'MedicationRequest/inhaler']);
    // The cascade rewrote the visit's reason, and that rewrite is what syncs.
    const visit = state.changes.find((c: any) => c.id === 'visit');
    expect(visit.payload).not.toContain('Condition/eczema');
  });
});
