import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
} from '@/src/features/testing/visualTest';

test.describe('View Condition View - Visual Regression', () => {
  test('Condition View - Details with Consultations', async ({
    page,
  }, testInfo) => {
    await seedTestPatient(page);
    const cond = await seedTestCondition(page, {
      id: 'cond-view-visual-test',
      title: 'Left Knee Pain',
      terminology: {
        system: 'https://example.org/diagnoses',
        code: 'KNEE',
        display: 'Left knee pain',
      },
      status: 'active',
      notes: 'Persistent ache after running on tarmac.',
      onsetDate: '2026-10-02',
    });
    await page.goto(`/condition/${cond.id}`);
    await page.getByTestId('condition-title').waitFor();
    await takeSnapshot(page, 'Condition View - No consultations', testInfo);
    await seedTestConsultation(page, {
      id: 'cons-cond-view-visual-follow-up',
      conditionIds: [cond.id],
      title: 'Follow-up for Left Knee Pain',
      doctorName: 'Dr. Marcus Welby',
      date: '2026-10-07',
      notes: 'Continue physiotherapy and review MRI results.',
      status: 'completed',
    });
    const second = await seedTestCondition(page, {
      id: 'condition-secondary-visual',
      title: 'Ligament injury',
    });
    await seedTestConsultation(page, {
      id: 'cons-cond-view-visual-test',
      conditionIds: [cond.id, second.id],
      title: 'Orthopedic Evaluation',
      doctorName: 'Dr. Sarah Connor',
      date: '2026-10-04',
      notes: 'MRI recommended for ligament check.',
      status: 'completed',
    });
    await seedTestTreatment(page, {
      id: 'treat-cond-view-visual',
      title: 'Ibuprofen 400mg',
      status: 'active',
      authoredOn: '2026-10-04',
      reasonConditionIds: [cond.id],
      requesterName: 'Dr. Sarah Connor',
    });

    await page.goto(`/condition/${cond.id}`);
    await page.getByTestId('condition-title').waitFor();

    await takeSnapshot(
      page,
      'Condition View - Details with Consultations',
      testInfo
    );
    await page.getByTestId('condition-add-button').click();
    await page.getByTestId('condition-add-menu').waitFor();
    await takeSnapshot(page, 'Condition View - Add menu', testInfo);
    await page.getByTestId('condition-add-button').click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('condition-add-menu').waitFor({ state: 'hidden' });
    // Chromatic archives inline styles before pending Reanimated updates finish.
    // Wait for the closed button's rendered appearance, not just aria-expanded.
    await page.waitForFunction(() => {
      const button = document.querySelector(
        '[data-testid="condition-add-button"]'
      );
      const icon = document.querySelector(
        '[data-testid="condition-add-button-icon"]'
      );
      return (
        button?.getAttribute('aria-expanded') === 'false' &&
        getComputedStyle(button).backgroundColor === 'rgb(61, 100, 80)' &&
        icon &&
        getComputedStyle(icon).transform === 'matrix(1, 0, 0, 1, 0, 0)'
      );
    });
    await takeSnapshot(page, 'Condition View - Wide layout', testInfo);
  });
});
