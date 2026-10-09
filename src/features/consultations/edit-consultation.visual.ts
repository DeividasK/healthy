import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestConsultation,
} from '@/src/features/testing/visualTest';

test.describe('Edit Consultation View - Visual Regression', () => {
  test('Consultation View - Edit Existing Mode', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    const cons = await seedTestConsultation(page, {
      id: 'cons-visual-test',
      title: 'Annual Physical Examination',
      doctorName: 'Dr. Jane Smith',
      date: '2026-10-05',
      notes: 'Blood pressure normal. Recommended regular follow-up.',
      status: 'completed',
    });

    await page.goto(`/consultation/${cons.id}/edit`);
    await page.getByTestId('consultation-title-input').waitFor();

    await takeSnapshot(
      page,
      'Consultation View - Edit Existing Mode',
      testInfo
    );
  });
});
