import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestTreatment,
} from '@/src/features/testing/visualTest';

test.describe('Edit Treatment - Visual Regression', () => {
  test('Populated form', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    const condition = await seedTestCondition(page, {
      title: 'Acute bacterial sinusitis',
    });
    const treatment = await seedTestTreatment(page, {
      title: 'Amoxicillin 500mg Capsule',
      intent: 'order',
      status: 'active',
      dosageInstructions:
        'Take 1 capsule by mouth every 8 hours with meals for 10 days.\nFinish all medication even if feeling better.',
      reason: 'Sinus infection',
      reasonConditionIds: [condition.id],
      notes: 'No penicillin allergies reported.',
    });

    await page.goto(`/treatment/${treatment.id}/edit`);
    await page.getByTestId('treatment-form-title').waitFor();
    await takeSnapshot(page, 'Treatment - Edit Form Populated', testInfo);
  });
});
