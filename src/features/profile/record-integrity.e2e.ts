import {
  test,
  expect,
  seedEveryResource,
  seedTestPatient,
  openRoute,
  findTreatmentsSection,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

const PATIENT = 'shared-patient';

test('deleting a condition or consultation keeps every record that referred to it, with its wording', async ({
  page,
}) => {
  await seedEveryResource(page);
  const result = await bridge(page, async (b) => {
    await b.deleteCondition('asthma');
    await b.deleteConsultation('visit');
    const projection = async (table: string, id: string) =>
      (
        await b.querySql(`SELECT consultation_id FROM ${table} WHERE id = ?`, [
          id,
        ])
      )[0];
    return {
      treatment: await b.getTreatment('inhaler'),
      treatmentRow: await projection('medication_requests', 'inhaler'),
      request: await b.getServiceRequest('referral'),
      requestRow: await projection('service_requests', 'referral'),
      encounter: await b.getConsultation('legacy-single'),
    };
  });
  // The treatment keeps its wording, loses the condition and its origin.
  expect(result.treatment.reason).toEqual([
    { concept: { text: 'Original indication' } },
  ]);
  expect(result.treatment.encounter).toBeUndefined();
  expect(result.treatmentRow.consultation_id).toBeNull();
  // The service request keeps itself without reason or origin.
  expect(result.request.reason).toBeUndefined();
  expect(result.request.encounter).toBeUndefined();
  expect(result.requestRow.consultation_id).toBeNull();
  // A consultation keeps its diagnosis text without the deleted Condition.
  expect(result.encounter.reason).toBeUndefined();
  expect(result.encounter.diagnosis).toEqual([
    {
      condition: [
        {
          concept: { text: 'Independent outcome', coding: [{ code: 'L21' }] },
        },
      ],
    },
  ]);

  // What remains stays editable.
  await openRoute(page, '/treatment/inhaler/edit');
  await page.getByTestId('treatment-title-input').fill('Inhaler, renamed');
  await page.getByTestId('save-treatment-button').click();
  await expect(page.getByTestId('treatment-title')).toHaveText(
    'Inhaler, renamed'
  );
  await expect(page.getByTestId('treatment-reason-section')).toContainText(
    'Original indication'
  );
});

test('a failed reference cleanup rolls back the whole deletion', async ({
  page,
}) => {
  await seedEveryResource(page);
  const visitDocument = await bridge(page, (b) =>
    b.getClinicalDocumentByConsultationId('visit')
  );
  // An imported document may list the treatment in a nested section too.
  visitDocument.section.push({
    title: 'Nested section',
    text: {
      status: 'additional',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Keep narrative</div>',
    },
    section: [
      {
        title: 'Nested entries',
        entry: [{ reference: 'MedicationRequest/inhaler' }],
      },
    ],
  });
  const result = await bridge(
    page,
    async (b, { patientId, document }) => {
      await b.saveClinicalDocument(document, patientId);
      const deletions = async () => {
        await b.flushLocalChanges();
        return await b.querySql(
          "SELECT resource_type, resource_id FROM sync_changes WHERE op = 'delete'"
        );
      };
      const failingDelete = async (
        table: string,
        run: () => Promise<unknown>
      ) => {
        await b.executeSql(
          `CREATE TRIGGER fail_cleanup BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'Synthetic cleanup failure'); END`
        );
        try {
          await run();
          return false;
        } catch {
          return true;
        } finally {
          await b.executeSql('DROP TRIGGER fail_cleanup');
        }
      };
      const pendingBefore = await deletions();
      const treatmentFailed = await failingDelete('clinical_documents', () =>
        b.deleteTreatment('inhaler', patientId)
      );
      const requestFailed = await failingDelete('consultations', () =>
        b.deleteServiceRequest('referral', patientId)
      );
      const afterFailures = {
        pending: await deletions(),
        treatment: await b.getTreatment('inhaler', patientId),
        request: await b.getServiceRequest('referral', patientId),
        basedOn: (await b.getConsultation('resulting-visit')).basedOn,
        document: await b.getClinicalDocumentByConsultationId('visit'),
      };
      // Retried without the failure, the deletion cleans every reference.
      await b.deleteTreatment('inhaler', patientId);
      return {
        treatmentFailed,
        requestFailed,
        pendingBefore,
        afterFailures,
        document: await b.getClinicalDocumentByConsultationId('visit'),
      };
    },
    { patientId: PATIENT, document: visitDocument }
  );
  expect(result.treatmentFailed).toBe(true);
  expect(result.requestFailed).toBe(true);
  const { afterFailures } = result;
  expect(afterFailures.pending).toEqual(result.pendingBefore);
  expect(afterFailures.treatment.id).toBe('inhaler');
  expect(afterFailures.request.id).toBe('referral');
  expect(afterFailures.basedOn).toEqual([
    { reference: 'ServiceRequest/referral', type: 'ServiceRequest' },
  ]);
  expect(afterFailures.document).toEqual(visitDocument);
  // Emptied sections are dropped (R5 cmp-1); a parent with text is kept
  expect(findTreatmentsSection(result.document)).toBeUndefined();
  const nested = result.document.section.at(-1);
  expect(nested.title).toBe('Nested section');
  expect(nested.text).toEqual(visitDocument.section.at(-1).text);
  expect(nested.section).toBeUndefined();
});

test('records only refer to their own profile, and a request has one origin', async ({
  page,
}) => {
  await seedEveryResource(page);
  await seedTestPatient(page, { id: 'other-patient', givenName: 'Bob' });
  const attempts = await bridge(page, async (b) => {
    // The other profile is active; Alice's records are foreign to it.
    const patientId = 'other-patient';
    const errors: string[] = [];
    const attempt = async (run: () => Promise<unknown>) => {
      try {
        await run();
        errors.push('');
      } catch (error) {
        errors.push((error as Error).message);
      }
    };
    const own = await b.seedConsultation({ patientId, title: 'Own visit' });
    const second = await b.seedConsultation({ patientId, title: 'Second' });
    const request = await b.seedServiceRequest({ patientId, title: 'Own' });
    for (const extra of [
      { reasonConditionIds: ['asthma'] },
      { diagnoses: [{ title: 'Outcome', conditionId: 'asthma' }] },
      { basedOnServiceRequestIds: ['referral'] },
    ])
      await attempt(() =>
        b.saveConsultation({
          id: 'rejected-visit',
          patientId,
          title: 'Rejected',
          date: '2026-10-13',
          ...extra,
        })
      );
    for (const extra of [
      { reasonConditionIds: ['asthma'] },
      { consultationId: 'visit' },
    ]) {
      await attempt(() =>
        b.updateTreatment({
          id: 'rejected-treatment',
          patientId,
          title: 'Rejected',
          ...extra,
        })
      );
      await attempt(() =>
        b.updateServiceRequest({
          id: 'rejected-request',
          patientId,
          title: 'Rejected',
          ...extra,
        })
      );
    }
    await attempt(() =>
      b.saveServiceRequestConsultationRoles(request.id, patientId, {
        [own.id]: 'origin',
        [second.id]: 'origin',
      })
    );
    return {
      errors,
      saved: {
        visit: await b.getConsultation('rejected-visit'),
        treatment: await b.getTreatment('rejected-treatment'),
        request: await b.getServiceRequest('rejected-request'),
      },
      origin: (await b.getServiceRequest(request.id)).encounter,
    };
  });
  expect(attempts.errors).toHaveLength(8);
  expect(attempts.errors.every(Boolean)).toBe(true);
  expect(attempts.errors.at(-1)).toContain('only one consultation');
  expect(attempts.saved).toEqual({
    visit: null,
    treatment: null,
    request: null,
  });
  expect(attempts.origin).toBeUndefined();
});
