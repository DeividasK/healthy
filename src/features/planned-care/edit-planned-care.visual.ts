import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestPlannedCare,
} from '@/src/features/testing/visualTest';

test.describe('Edit Planned Care - Visual Regression', () => {
  test('Populated form with consultation roles', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const condition = await seedTestCondition(page, { title: 'Gallstones' });
    const origin = await seedTestConsultation(page, {
      title: 'Gastroenterology review',
      date: '2026-03-02',
    });
    const request = await seedTestPlannedCare(page, {
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

    await page.goto(`/planned-care/${request.id}/edit`);
    await page.getByTestId('planned-care-form-title').waitFor();
    await takeSnapshot(page, 'Planned Care - Edit Form Populated', testInfo);
  });
});
