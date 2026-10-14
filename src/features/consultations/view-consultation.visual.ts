import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
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
    const second = await seedTestCondition(page, {
      id: 'second-diagnosis-visual',
      title: 'Ligament injury with a long original diagnosis description',
    });
    const consultation = await seedTestConsultation(page, {
      id: 'consultation-view-visual',
      conditionIds: [second.id],
      reasonConditionIds: [condition.id],
      title: 'Orthopedic Evaluation',
      doctorName: 'Dr. Sarah Connor',
      serviceType: 'Orthopedics',
      date: '2026-10-04',
      notes: 'MRI recommended for ligament check.',
      status: 'completed',
    });

    await seedTestTreatment(page, {
      id: 'linked-visual-treatment',
      title: 'Treatment recommendation',
      consultationId: consultation.id,
      dosageInstructions: 'Complete original instructions.',
    });
    await page.goto(`/consultation/${consultation.id}`);
    await page.getByTestId('consultation-title').waitFor();
    await takeSnapshot(page, 'Consultation View - Details', testInfo);
    await page.setViewportSize({ width: 1280, height: 900 });
    await takeSnapshot(page, 'Consultation View - Wide layout', testInfo);
  });
});
