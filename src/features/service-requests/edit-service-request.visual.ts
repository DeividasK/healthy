import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestServiceRequest,
  seedTestReport,
} from '@/src/features/testing/visualTest';

test.describe('Edit Service Request - Visual Regression', () => {
  test('Populated form with consultation roles', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const condition = await seedTestCondition(page, { title: 'Gallstones' });
    const origin = await seedTestConsultation(page, {
      title: 'Gastroenterology review',
      date: '2026-03-02',
    });
    const request = await seedTestServiceRequest(page, {
      title: 'Abdominal ultrasound',
      category: '363679005',
      intent: 'order',
      status: 'active',
      authoredOn: '2026-03-02',
      consultationId: origin.id,
      plannedDate: '2026-04-20',
      requesterName: 'Dr. Leonard McCoy',
      instructions:
        'Fast for 8 hours beforehand.\nBook within 2 weeks of this visit.',
      reason: 'Right upper quadrant pain',
      reasonConditionIds: [condition.id],
      notes: 'Referral letter given.',
    });
    await seedTestConsultation(page, {
      title: 'Ultrasound appointment',
      date: '2026-04-20',
      basedOnServiceRequestIds: [request.id],
    });
    await seedTestReport(page, {
      date: '2026-04-21',
      serviceRequestIds: [request.id],
      biomarkers: [{ name: 'Hemoglobin', value: 13.1 }],
    });

    await page.goto(`/service-request/${request.id}/edit`);
    await page.getByTestId('service-request-form-title').waitFor();
    await takeSnapshot(page, 'Service Request - Edit Form Populated', testInfo);
  });
});
