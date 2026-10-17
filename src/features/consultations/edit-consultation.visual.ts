import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
} from '@/src/features/testing/visualTest';

test.describe('Edit Consultation View - Visual Regression', () => {
  test('Consultation View - Edit Existing Mode', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await seedTestCondition(page, {
      id: 'edit-first',
      title: 'First diagnosis',
    });
    await seedTestCondition(page, {
      id: 'edit-second',
      title: 'Second diagnosis with a longer description',
    });
    const cons = await seedTestConsultation(page, {
      id: 'cons-visual-test',
      conditionIds: ['edit-first', 'edit-second'],
      title: 'Annual Physical Examination',
      doctorName: 'Dr. Jane Smith',
      date: '2026-10-05',
      notes: 'Blood pressure normal. Recommended regular follow-up.',
      status: 'completed',
    });

    await page.goto(`/consultation/${cons.id}/edit`);
    await page.getByTestId('consultation-title-input').waitFor();
    await page.getByTestId('diagnosis-1-title-input').waitFor();
    await page.getByTestId('diagnosis-1-add').click();
    await page.getByTestId('diagnosis-option-code').click();
    await page.getByTestId('diagnosis-options-menu').waitFor({
      state: 'detached',
    });
    await page.getByTestId('diagnosis-1-code-input').fill('L21');
    await takeSnapshot(
      page,
      'Consultation View - Edit Existing Mode',
      testInfo
    );
  });
});
