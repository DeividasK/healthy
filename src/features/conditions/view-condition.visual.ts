import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
} from '@/src/features/testing/visualTest';

test.describe('View Condition View - Visual Regression', () => {
  test('Condition View - Details with Consultations', async ({
    page,
  }, testInfo) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    const cond = await seedTestCondition(page, {
      id: 'cond-view-visual-test',
      title: 'Left Knee Pain',
      status: 'active',
      notes: 'Persistent ache after running on tarmac.',
      onsetDate: '2026-10-02',
    });
    await seedTestConsultation(page, {
      id: 'cons-cond-view-visual-test',
      conditionId: cond.id,
      title: 'Orthopedic Evaluation',
      doctorName: 'Dr. Sarah Connor',
      date: '2026-10-04',
      notes: 'MRI recommended for ligament check.',
      status: 'completed',
    });

    await page.goto(`/condition/${cond.id}`);
    await page.getByTestId('condition-title').waitFor();

    await takeSnapshot(
      page,
      'Condition View - Details with Consultations',
      testInfo
    );
  });
});
