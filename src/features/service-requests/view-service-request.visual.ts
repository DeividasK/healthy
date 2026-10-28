import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestServiceRequest,
  seedTestReport,
  seedTestResources,
} from '@/src/features/testing/visualTest';

test.describe('View Service Request - Visual Regression', () => {
  test('Long instructions and every related section', async ({
    page,
  }, testInfo) => {
    const patient = await seedTestPatient(page);
    const condition = await seedTestCondition(page, { title: 'Palpitations' });
    const origin = await seedTestConsultation(page, {
      title: 'GP visit',
      doctorName: 'Dr. Beverly Crusher',
      date: '2026-02-03',
    });
    const linked = await seedTestConsultation(page, {
      title: 'Cardiology review',
      date: '2026-02-20',
    });
    const longInstructions = [
      '1. Book the appointment within 6 weeks of this visit.',
      '2. Bring a list of current medications and previous ECGs.',
      '3. Avoid caffeine for 24 hours before the monitor is fitted.',
      '4. Keep a diary of symptoms while wearing the monitor.',
    ].join('\n\n');
    const request = await seedTestServiceRequest(page, {
      title: '24-hour Holter monitor',
      category: '71388002',
      intent: 'order',
      status: 'active',
      authoredOn: '2026-02-03',
      consultationId: origin.id,
      schedule: {
        period: 4,
        periodMax: 6,
        periodUnit: 'wk',
        count: 3,
        duration: 45,
      },
      requesterName: 'Dr. Beverly Crusher',
      instructions: longInstructions,
      reason: 'Intermittent palpitations',
      reasonConditionIds: [condition.id],
      notes: 'Results go to the cardiology clinic.',
    });
    await seedTestResources(page, {
      procedureLogs: [
        { serviceRequestId: request.id, date: '2026-03-10', answer: 'taken' },
        {
          serviceRequestId: request.id,
          date: '2026-04-07',
          answer: 'taken',
          duration: 50,
        },
      ],
    });
    await page.evaluate(
      ({ requestId, consultationId, patientId }) =>
        (
          window as any
        ).__HEALTHY_TEST_BRIDGE__.setServiceRequestConsultationRole(
          requestId,
          consultationId,
          patientId,
          'planned'
        ),
      {
        requestId: request.id,
        consultationId: linked.id,
        patientId: patient.id,
      }
    );
    await seedTestConsultation(page, {
      title: 'Holter fitting',
      date: '2026-03-10',
      basedOnServiceRequestIds: [request.id],
    });
    await seedTestReport(page, {
      date: '2026-03-11',
      serviceProviderName: 'City Lab',
      serviceRequestIds: [request.id],
      biomarkers: [
        {
          name: 'Hemoglobin',
          value: 14.5,
          unit: 'g/dL',
          referenceLow: 11.6,
          referenceHigh: 16.6,
        },
      ],
    });

    await page.goto(`/service-request/${request.id}`);
    await page.getByTestId('service-request-title').waitFor();
    await page.getByTestId('service-request-session-2').waitFor();
    await takeSnapshot(page, 'Service Request View - Details', testInfo);
  });
});
