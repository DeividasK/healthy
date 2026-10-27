import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestResources,
  seedTestReport,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  seedTestServiceRequest,
} from '@/src/features/testing/visualTest';

test.describe('Home View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('Home View - Empty State', async ({ page }, testInfo) => {
    await page.getByTestId('start-your-record').waitFor();

    await takeSnapshot(page, 'Home View - Empty State', testInfo);
  });

  test('Home View - Condition and Consultation cards', async ({
    page,
  }, testInfo) => {
    await seedTestCondition(page, {
      id: 'condition-home-visual',
      title: 'Left Knee Pain',
      onsetDate: '2026-10-02',
      notes: 'Persistent ache after running.',
    });
    await seedTestConsultation(page, {
      id: 'consultation-home-visual',
      title: 'Annual Physical Exam',
      date: '2026-10-04',
      doctorName: 'Dr. Sarah Connor',
      notes: 'Follow-up next year.',
    });
    await seedTestTreatment(page, {
      id: 'home-treatment',
      title: 'Lisinopril 10mg',
      dosageInstructions: 'Take 1 tablet daily.',
    });
    await seedTestServiceRequest(page, {
      id: 'home-service-request',
      title: 'Knee MRI',
      category: '363679005',
      authoredOn: '2026-10-04',
      consultationId: 'consultation-home-visual',
      reasonConditionIds: ['condition-home-visual'],
    });
    await seedTestCondition(page, {
      id: 'second-home-visual',
      title: 'Ligament injury',
    });
    await seedTestConsultation(page, {
      id: 'multi-home-visual',
      title: 'Combined review',
      conditionIds: ['condition-home-visual', 'second-home-visual'],
    });
    await page.goto('/');
    await page.getByTestId('condition-card-second-home-visual').waitFor();
    await takeSnapshot(
      page,
      'Home View - Shared consultation diagnoses',
      testInfo
    );
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('floating-add-menu').waitFor();
    await takeSnapshot(page, 'Home View - Add menu', testInfo);
  });

  test('Home View - Populated with Single Report', async ({
    page,
  }, testInfo) => {
    await seedTestReport(page, {
      id: 'report-home-single',
      date: '2026-10-02',
      biomarkers: [
        { name: 'Hemoglobin', value: 14.5 },
        { name: 'White Blood Cells', value: 6.8 },
      ],
      notes: 'Routine morning blood test',
    });

    await page.goto('/');
    await page
      .getByTestId('results-scroll-view')
      .getByTestId('labs-summary-grid-cell-718-7')
      .waitFor();

    await takeSnapshot(page, 'Home View - Populated Single Report', testInfo);
  });

  test('Home View - Multi-Report with All Status Badges', async ({
    page,
  }, testInfo) => {
    await seedTestReport(page, {
      id: 'report-home-multi-1',
      date: '2026-10-02',
      biomarkers: [
        { name: 'Hemoglobin', value: 15.2 },
        { name: 'White Blood Cells', value: 3.1 },
        { name: 'Platelets', value: 480 },
      ],
      notes: 'Follow-up consultation notes',
    });

    await seedTestReport(page, {
      id: 'report-home-multi-2',
      date: '2020-10-02',
      biomarkers: [
        { name: 'Red Blood Cells', value: 4.7 },
        { name: 'Hematocrit', value: 41.5 },
      ],
    });

    await seedTestReport(page, {
      id: 'report-home-multi-older',
      date: '2026-09-20',
      biomarkers: [{ name: 'Hemoglobin', value: 8 }],
    });
    await page.goto('/');
    await page.getByTestId('labs-summary-grid-cell-777-3').waitFor();

    await takeSnapshot(
      page,
      'Home View - Multi-Report with Status Badges',
      testInfo
    );
    await page
      .getByRole('combobox', { name: 'Period' })
      .selectOption({ label: '1 month' });
    await takeSnapshot(page, 'Home View - Labs Summary last month', testInfo);
    await page.screenshot({ path: testInfo.outputPath('labs-summary.png') });
  });
  test('Home View - Collapsed and expanded sections', async ({
    page,
  }, testInfo) => {
    await seedTestResources(page, {
      conditions: [1, 2, 3, 4].map((n) => ({
        id: `collapse-condition-${n}`,
        title: `Condition ${n}`,
        onsetDate: `2026-0${n}-01`,
      })),
      consultations: [1, 2, 3, 4].map((n) => ({
        id: `collapse-consultation-${n}`,
        title: `Consultation ${n}`,
        date: `2026-0${n}-15`,
        doctorName: `Specialist ${n}`,
        conditionIds: [`collapse-condition-${n}`],
      })),
    });

    await page.getByTestId('conditions-list-toggle').waitFor();
    await takeSnapshot(page, 'Home View - Collapsed sections', testInfo);
    await page.getByTestId('conditions-list-toggle').click();
    await page.getByTestId('consultations-list-toggle').click();
    await page.getByTestId('condition-card-collapse-condition-1').waitFor();
    await takeSnapshot(page, 'Home View - Expanded sections', testInfo);
  });
});

test('App - Loading placeholders', async ({ page }, testInfo) => {
  // Holds the SQLite worker so the database stays closed while capturing.
  await page.route(/expo-sqlite\/web\/worker|wa-sqlite\.wasm/, () => {});

  await page.goto('/');
  await page
    .getByTestId('app-loading-skeleton')
    .getByTestId('skeleton-row')
    .first()
    .waitFor();
  await takeSnapshot(page, 'App - Loading', testInfo);
});

test('App - Loading placeholders (desktop)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Holds the SQLite worker so the database stays closed while capturing.
  await page.route(/expo-sqlite\/web\/worker|wa-sqlite\.wasm/, () => {});

  await page.goto('/');
  await page.getByTestId('app-sidebar-placeholder').waitFor();
  await page
    .getByTestId('app-loading-skeleton')
    .getByTestId('skeleton-row')
    .first()
    .waitFor();
  await takeSnapshot(page, 'App - Loading (desktop)', testInfo);
});
