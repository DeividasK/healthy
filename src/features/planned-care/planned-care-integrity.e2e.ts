import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestPlannedCare,
  getTestPlannedCare,
  getTestClinicalDocument,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

const PATIENT = 'planned-care-integrity-patient';

test.beforeEach(async ({ page }) => {
  await seedTestPatient(page, { id: PATIENT });
});

test('v14 creates the service request table with sync capture', async ({
  page,
}) => {
  const schema = await bridge(page, (b) =>
    b.querySql(
      "SELECT name FROM sqlite_master WHERE name LIKE '%service_requests%' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    )
  );
  expect(schema.map((row: any) => row.name)).toEqual([
    'idx_service_requests_consultation_id',
    'idx_service_requests_patient_id',
    'idx_service_requests_requisition',
    'service_requests',
    'sync_service_requests_delete',
    'sync_service_requests_insert',
    'sync_service_requests_update',
  ]);
  const request = await seedTestPlannedCare(page, { title: 'Chest X-ray' });
  const dirty = await bridge(
    page,
    (b, id) =>
      b.querySql(
        'SELECT resource_type FROM sync_dirty WHERE resource_id = ?;',
        [id]
      ),
    request.id
  );
  expect(dirty).toEqual([{ resource_type: 'ServiceRequest' }]);
});

test('deleting the origin consultation keeps the request and clears its origin', async ({
  page,
}) => {
  const consultation = await seedTestConsultation(page, {
    title: 'Orthopaedic review',
  });
  const request = await seedTestPlannedCare(page, {
    title: 'Knee MRI',
    consultationId: consultation.id,
  });
  await bridge(page, (b, id) => b.deleteConsultation(id), consultation.id);
  const [row] = await bridge(
    page,
    (b, id) =>
      b.querySql(
        'SELECT consultation_id, fhir_json FROM service_requests WHERE id = ?;',
        [id]
      ),
    request.id
  );
  expect(row.consultation_id).toBeNull();
  expect(JSON.parse(row.fhir_json).encounter).toBeUndefined();
});

test('deleting a reason condition keeps the request and its wording', async ({
  page,
}) => {
  const condition = await seedTestCondition(page, { title: 'Back pain' });
  const request = await seedTestPlannedCare(page, {
    title: 'Physiotherapy referral',
    reason: 'Persistent lower back pain',
    reasonConditionIds: [condition.id],
  });
  await bridge(page, (b, id) => b.deleteCondition(id), condition.id);
  const cleaned = await getTestPlannedCare(page, request.id);
  expect(cleaned.reason).toEqual([
    { concept: { text: 'Persistent lower back pain' } },
  ]);
});

test('failed reference cleanup rolls back the deletion', async ({ page }) => {
  const origin = await seedTestConsultation(page, { title: 'Rollback visit' });
  const request = await seedTestPlannedCare(page, {
    title: 'Rollback request',
    consultationId: origin.id,
  });
  const visit = await seedTestConsultation(page, {
    title: 'Based-on visit',
    basedOnServiceRequestIds: [request.id],
  });
  const before = await getTestClinicalDocument(page, origin.id);
  const result = await bridge(
    page,
    async (b, { requestId, patientId, visitId }) => {
      await b.executeSql(
        "CREATE TRIGGER fail_basedon_cleanup BEFORE UPDATE ON consultations BEGIN SELECT RAISE(ABORT, 'Synthetic cleanup failure'); END"
      );
      let failed = false;
      try {
        await b.deletePlannedCare(requestId, patientId);
      } catch {
        failed = true;
      }
      await b.executeSql('DROP TRIGGER fail_basedon_cleanup');
      return {
        failed,
        retained: await b.getPlannedCare(requestId, patientId),
        visit: await b.getConsultation(visitId),
      };
    },
    { requestId: request.id, patientId: PATIENT, visitId: visit.id }
  );
  expect(result.failed).toBe(true);
  expect(result.retained.id).toBe(request.id);
  expect(result.visit.basedOn).toEqual([
    { reference: `ServiceRequest/${request.id}`, type: 'ServiceRequest' },
  ]);
  expect(await getTestClinicalDocument(page, origin.id)).toEqual(before);
});

test('rejects foreign references and a second origin without saving', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'foreign-planned-care-patient' });
  await bridge(page, async (b) => {
    await b.seedCondition({
      id: 'foreign-reason',
      patientId: 'foreign-planned-care-patient',
      title: 'Foreign condition',
    });
    await b.seedConsultation({
      id: 'foreign-visit',
      patientId: 'foreign-planned-care-patient',
      title: 'Foreign visit',
    });
    await b.seedPlannedCare({
      id: 'foreign-request',
      patientId: 'foreign-planned-care-patient',
      title: 'Foreign request',
    });
  });
  const first = await seedTestConsultation(page, {
    patientId: PATIENT,
    title: 'Own visit',
  });
  const second = await seedTestConsultation(page, {
    patientId: PATIENT,
    title: 'Other own visit',
  });
  const own = await seedTestPlannedCare(page, {
    patientId: PATIENT,
    title: 'Own request',
  });

  const attempts = await bridge(
    page,
    async (b, { patientId, ownId, firstId, secondId }) => {
      const errors: string[] = [];
      const attempt = async (run: () => Promise<unknown>) => {
        try {
          await run();
        } catch (error) {
          errors.push((error as Error).message);
        }
      };
      for (const input of [
        { reasonConditionIds: ['foreign-reason'] },
        { consultationId: 'foreign-visit' },
      ])
        await attempt(() =>
          b.updatePlannedCare({
            id: 'rejected-request',
            patientId,
            title: 'Rejected reference',
            ...input,
          })
        );
      await attempt(() =>
        b.seedConsultation({
          patientId,
          title: 'Based on a foreign request',
          basedOnServiceRequestIds: ['foreign-request'],
        })
      );
      await attempt(() =>
        b.savePlannedCareConsultationRoles(ownId, patientId, {
          [firstId]: 'origin',
          [secondId]: 'origin',
        })
      );
      return {
        errors,
        rejected: await b.getPlannedCare('rejected-request'),
        consultations: await b.querySql(
          "SELECT id FROM consultations WHERE title = 'Based on a foreign request';"
        ),
        own: await b.getPlannedCare(ownId),
      };
    },
    {
      patientId: PATIENT,
      ownId: own.id,
      firstId: first.id,
      secondId: second.id,
    }
  );
  expect(attempts.errors).toHaveLength(4);
  expect(attempts.errors.at(-1)).toContain('only one consultation');
  expect(attempts.rejected).toBeNull();
  expect(attempts.consultations).toEqual([]);
  expect(attempts.own.encounter).toBeUndefined();
});
