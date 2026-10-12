import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
} from '@/src/features/testing/visualTest';

test.describe('View Consultation - Visual Regression', () => {
  test('Consultation details with related condition', async ({
    page,
  }, testInfo) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    const condition = await seedTestCondition(page, {
      id: 'condition-view-consultation-visual',
      title: 'Left Knee Pain',
      status: 'active',
      onsetDate: '2026-10-02',
    });
    const consultation = await seedTestConsultation(page, {
      id: 'consultation-view-visual',
      conditionId: condition.id,
      title: 'Orthopedic Evaluation',
      doctorName: 'Dr. Sarah Connor',
      serviceType: 'Orthopedics',
      date: '2026-10-04',
      notes: 'MRI recommended for ligament check.',
      status: 'completed',
    });

    await page.goto(`/consultation/${consultation.id}`);
    await page.getByTestId('consultation-title').waitFor();
    await takeSnapshot(page, 'Consultation View - Details', testInfo);
  });
});
