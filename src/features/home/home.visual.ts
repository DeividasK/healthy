import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';

// The visual fixture fixes today at 2026-10-08 (a Thursday).

/** Two treatments the journal asks about, so a day can be partly answered. */
const treatments = [
  {
    id: 'home-treatment',
    title: 'Lisinopril 10mg',
    status: 'active' as const,
    authoredOn: '2026-09-20',
    takingSince: '2026-09-20',
    dosageInstructions: 'Take 1 tablet daily.',
  },
  {
    id: 'home-treatment-vitamin-d',
    title: 'Vitamin D 1000 IU',
    status: 'active' as const,
    authoredOn: '2026-09-20',
    takingSince: '2026-09-20',
  },
];
const fullDay = (date: string) =>
  treatments.map(({ id }) => ({
    treatmentId: id,
    date,
    answer: 'taken' as const,
  }));
/**
 * The week strip (Oct 2-8) shows complete days, a partly answered day
 * (Oct 5), an unanswered day (Oct 7) and a partly answered today.
 */
const treatmentLogs = [
  ...['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-06'].flatMap(fullDay),
  {
    treatmentId: 'home-treatment',
    date: '2026-10-05',
    answer: 'not-taken' as const,
  },
  {
    treatmentId: 'home-treatment',
    date: '2026-10-08',
    answer: 'taken' as const,
  },
];

test('Home View - Populated', async ({ page }, testInfo) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    conditions: [
      {
        id: 'condition-home-visual',
        title: 'Left Knee Pain',
        onsetDate: '2026-10-02',
        notes: 'Persistent ache after running.',
      },
      { id: 'second-home-visual', title: 'Ligament injury' },
      // Older items, so both lists have more than they show collapsed.
      ...[1, 2].map((n) => ({
        id: `collapse-condition-${n}`,
        title: `Condition ${n}`,
        onsetDate: `2026-0${n}-01`,
      })),
    ],
    consultations: [
      {
        id: 'consultation-home-visual',
        title: 'Annual Physical Exam',
        date: '2026-10-04',
        doctorName: 'Dr. Sarah Connor',
        notes: 'Follow-up next year.',
      },
      {
        id: 'multi-home-visual',
        title: 'Combined review',
        conditionIds: ['condition-home-visual', 'second-home-visual'],
      },
      ...[1, 2].map((n) => ({
        id: `collapse-consultation-${n}`,
        title: `Consultation ${n}`,
        date: `2026-0${n}-15`,
        doctorName: `Specialist ${n}`,
        conditionIds: [`collapse-condition-${n}`],
      })),
    ],
    treatments,
    treatmentLogs,
    serviceRequests: [
      {
        id: 'home-service-request',
        title: 'Knee MRI',
        category: '363679005',
        authoredOn: '2026-10-04',
        consultationId: 'consultation-home-visual',
        reasonConditionIds: ['condition-home-visual'],
      },
    ],
    // In range, low and high cells, an older out-of-range Hemoglobin and
    // results older than six months.
    reports: [
      {
        id: 'report-home-multi-1',
        date: '2026-10-02',
        biomarkers: [
          {
            name: 'Hemoglobin',
            value: 15.2,
            referenceLow: 11.6,
            referenceHigh: 16.6,
          },
          {
            name: 'White Blood Cells',
            value: 3.1,
            referenceLow: 4.5,
            referenceHigh: 11,
          },
          {
            name: 'Platelets',
            value: 480,
            referenceLow: 150,
            referenceHigh: 450,
          },
        ],
        notes: 'Follow-up consultation notes',
      },
      {
        id: 'report-home-multi-2',
        date: '2020-10-02',
        biomarkers: [
          {
            name: 'Red Blood Cells',
            value: 4.7,
            referenceLow: 3.92,
            referenceHigh: 5.65,
          },
          {
            name: 'Hematocrit',
            value: 41.5,
            referenceLow: 35.5,
            referenceHigh: 48.6,
          },
        ],
      },
      {
        id: 'report-home-multi-older',
        date: '2026-09-20',
        biomarkers: [
          {
            name: 'Hemoglobin',
            value: 8,
            referenceLow: 11.6,
            referenceHigh: 16.6,
          },
        ],
      },
    ],
  });
  await page.goto('/');
  await page.getByTestId('labs-summary-grid-cell-777-3').waitFor();
  await page.getByTestId('home-action-day-2026-10-08-partial').waitFor();
  // Conditions expanded and Consultations collapsed show both toggle states.
  await page.getByTestId('conditions-list-toggle').click();
  await page.getByTestId('condition-card-collapse-condition-1').waitFor();
  await page.getByTestId('consultations-list-toggle').waitFor();
  await takeSnapshot(page, 'Home View - Populated', testInfo);

  await page.getByTestId('floating-add-button').click();
  await page.getByTestId('floating-add-menu').waitFor();
  await takeSnapshot(page, 'Home View - Add menu', testInfo);
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
