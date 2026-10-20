import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  seedTestServiceRequest,
  seedTestReport,
  openRoute,
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
      onsetDate: '2026-09-02',
    });
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
    const mri = await seedTestServiceRequest(page, {
      id: 'mri-cond-view-visual',
      title: 'MRI left knee',
      category: '363679005',
      intent: 'order',
      status: 'completed',
      authoredOn: '2026-10-04',
      reasonConditionIds: [cond.id],
      requesterName: 'Dr. Sarah Connor',
    });
    await seedTestReport(page, {
      id: 'report-cond-view-visual',
      date: '2026-10-05',
      time: '08:15',
      serviceProviderName: 'City Lab',
      serviceRequestIds: [mri.id],
      biomarkers: [{ name: 'Hemoglobin', value: 14.5, unit: 'g/dL' }],
    });
    await seedTestConsultation(page, {
      id: 'cons-cond-view-visual-planned',
      conditionIds: [cond.id],
      title: 'MRI review',
      doctorName: 'Dr. Sarah Connor',
      date: '2026-11-03',
      status: 'planned',
    });
    await seedTestServiceRequest(page, {
      id: 'planned-cond-view-visual',
      title: 'Physiotherapy referral',
      category: '3457005',
      intent: 'order',
      status: 'active',
      authoredOn: '2026-09-12',
      reasonConditionIds: [cond.id],
    });
    await seedTestTreatment(page, {
      id: 'treat-cond-view-visual-paused',
      title: 'Paracetamol 500mg',
      status: 'on-hold',
      authoredOn: '2026-09-02',
      reasonConditionIds: [cond.id],
    });
    await seedTestServiceRequest(page, {
      id: 'revoked-cond-view-visual',
      title: 'X-ray left knee',
      category: '363679005',
      intent: 'order',
      status: 'revoked',
      authoredOn: '2026-09-02',
      reasonConditionIds: [cond.id],
    });

    await openRoute(page, `/condition/${cond.id}`);
    await page.getByTestId('condition-title').waitFor();

    await takeSnapshot(
      page,
      'Condition View - Details with Consultations',
      testInfo
    );
    await page.getByTestId('condition-timeline-filter-button').click();
    await page.getByTestId('condition-timeline-filter-tone-planned').click();
    await page.getByTestId('condition-timeline-filter-tone-active').click();
    await takeSnapshot(page, 'Condition View - Timeline filters', testInfo);
    await page.getByTestId('condition-timeline-filters-done').click();
    await page
      .getByTestId('condition-timeline-filters-card')
      .waitFor({ state: 'detached' });
    await takeSnapshot(page, 'Condition View - Filtered timeline', testInfo);
    await page.getByTestId('condition-timeline-filter-button').click();
    await page.getByTestId('condition-timeline-filters-reset').click();
    await page.getByTestId('condition-timeline-filters-done').click();
    await page
      .getByTestId('condition-timeline-filters-card')
      .waitFor({ state: 'detached' });

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
