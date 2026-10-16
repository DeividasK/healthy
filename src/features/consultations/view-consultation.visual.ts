import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  seedTestServiceRequest,
} from '@/src/features/testing/visualTest';

test.describe('View Consultation - Visual Regression', () => {
  test('Consultation details with related condition', async ({
    page,
  }, testInfo) => {
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
    const referral = await seedTestServiceRequest(page, {
      id: 'referral-view-visual',
      title: 'Orthopaedic referral',
      category: '3457005',
      authoredOn: '2026-09-20',
    });
    const consultation = await seedTestConsultation(page, {
      id: 'consultation-view-visual',
      basedOnServiceRequestIds: [referral.id],
      conditionIds: [second.id],
      reasonConditionIds: [condition.id],
      title: 'Orthopedic Evaluation',
      doctorName: 'Dr. Sarah Connor',
      serviceProviderName: 'City Hospital',
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
    await seedTestServiceRequest(page, {
      id: 'planned-view-visual',
      title: 'Knee MRI',
      category: '363679005',
      authoredOn: '2026-10-04',
      consultationId: consultation.id,
    });
    await page.goto(`/consultation/${consultation.id}`);
    await page.getByTestId('consultation-title').waitFor();
    await takeSnapshot(page, 'Consultation View - Details', testInfo);
    await page.setViewportSize({ width: 1280, height: 900 });
    await takeSnapshot(page, 'Consultation View - Wide layout', testInfo);
  });
});
