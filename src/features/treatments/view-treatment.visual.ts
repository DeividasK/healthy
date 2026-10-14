import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestTreatment,
  seedTestConsultation,
} from '@/src/features/testing/visualTest';

test.describe('View Treatment - Visual Regression', () => {
  test('Long instructions, reason condition and consultation link', async ({
    page,
  }, testInfo) => {
    await seedTestPatient(page);
    const consultation = await seedTestConsultation(page, {
      title: 'Infectious Disease Clinic',
      doctorName: 'Dr. Beverly Crusher',
      serviceType: 'Infectious Disease',
    });
    const condition = await seedTestCondition(page, {
      title: 'Tick bite',
    });
    const longInstructions = [
      '1. Take 2 tablets in the morning and 2 tablets in the evening with food.',
      '2. Stay hydrated by drinking at least 2 liters of water daily.',
      '3. In case of rash, discontinue immediately and contact the clinic.',
      '4. Complete the entire 14-day regimen without interruption.',
    ].join('\n\n');

    const treatment = await seedTestTreatment(page, {
      title: 'Doxycycline Hyclate 100mg',
      intent: 'order',
      status: 'active',
      consultationId: consultation.id,
      dosageInstructions: longInstructions,
      reason: 'Lyme disease prophylaxis',
      reasonConditionIds: [condition.id],
      notes: 'Monitored for sun sensitivity.',
    });

    await page.goto(`/treatment/${treatment.id}`);
    await page.getByTestId('treatment-title').waitFor();
    await takeSnapshot(page, 'Treatment View - Details', testInfo);

    await page.setViewportSize({ width: 1280, height: 900 });
    await takeSnapshot(page, 'Treatment View - Wide layout', testInfo);
  });
});
