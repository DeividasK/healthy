import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestPlannedCare,
} from '@/src/features/testing/visualTest';

test.describe('View Planned Care - Visual Regression', () => {
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
    const request = await seedTestPlannedCare(page, {
      title: '24-hour Holter monitor',
      category: '71388002',
      intent: 'order',
      status: 'active',
      authoredOn: '2026-02-03',
      consultationId: origin.id,
      plannedDate: '2026-03-10',
      requesterName: 'Dr. Beverly Crusher',
      instructions: longInstructions,
      reason: 'Intermittent palpitations',
      reasonConditionIds: [condition.id],
      notes: 'Results go to the cardiology clinic.',
    });
    await page.evaluate(
      ({ requestId, consultationId, patientId }) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.setPlannedCareConsultationRole(
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

    await page.goto(`/planned-care/${request.id}`);
    await page.getByTestId('planned-care-title').waitFor();
    await takeSnapshot(page, 'Planned Care View - Details', testInfo);

    await page.setViewportSize({ width: 1280, height: 900 });
    await takeSnapshot(page, 'Planned Care View - Wide layout', testInfo);
  });
});
