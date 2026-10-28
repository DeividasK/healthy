import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';
import type { Page } from '@playwright/test';

const seedTreatments = async (page: Page) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    conditions: [{ id: 'visual-deficiency', title: 'Vitamin D deficiency' }],
    treatments: [
      {
        id: 'visual-vitamin-d',
        title: 'Vitamin D3 4000 IU',
        status: 'active',
        intent: 'plan',
        authoredOn: '2026-09-01',
        takingSince: '2026-09-01',
        reasonConditionIds: ['visual-deficiency'],
      },
      {
        id: 'visual-magnesium',
        title: 'Magnesium glycinate',
        status: 'active',
        intent: 'plan',
        authoredOn: '2026-08-15',
      },
      {
        id: 'visual-doxycycline',
        title: 'Doxycycline Hyclate 100mg',
        status: 'completed',
        intent: 'order',
        authoredOn: '2026-07-02',
        requesterName: 'Dr. Beverly Crusher',
      },
      {
        id: 'visual-ibuprofen',
        title: 'Ibuprofen 400mg',
        status: 'active',
        intent: 'order',
        authoredOn: '2026-10-01',
      },
    ],
    treatmentUsage: [
      { treatmentId: 'visual-magnesium', action: 'start', date: '2026-08-15' },
      { treatmentId: 'visual-magnesium', action: 'pause', date: '2026-10-01' },
      {
        treatmentId: 'visual-doxycycline',
        action: 'start',
        date: '2026-07-02',
      },
      { treatmentId: 'visual-doxycycline', action: 'stop', date: '2026-07-16' },
    ],
  });
};

test('Treatments page - all treatments and filtered by status', async ({
  page,
}, testInfo) => {
  await seedTreatments(page);
  await page.goto('/treatments');
  const view = page.getByTestId('treatments-view');
  await view.getByTestId('treatments-row-visual-ibuprofen').waitFor();
  await takeSnapshot(page, 'Treatments - all', testInfo);
  await view.getByTestId('treatments-filter-button').click();
  await page.getByTestId('treatments-filter-status-taking').click();
  await page.getByTestId('treatments-filter-status-on-hold').click();
  await takeSnapshot(page, 'Treatments - filters', testInfo);
});

test('Treatments page - desktop list beside the chosen treatment', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedTreatments(page);
  // Open a treatment that is not started, so the view shows no Usage section
  // and the dock offers Start (Play); 'Treatment View - Details' covers taking.
  await page.goto('/treatments?treatment=visual-ibuprofen');
  await page.getByTestId('treatment-title').waitFor();
  await page.getByTestId('treatment-usage-start').waitFor();
  await page.getByTestId('treatments-row-visual-ibuprofen').waitFor();
  await takeSnapshot(page, 'Treatments - desktop', testInfo);
});
