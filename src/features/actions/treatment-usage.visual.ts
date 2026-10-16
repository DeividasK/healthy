import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';

test('Usage form: start, stop with notes, resume', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    treatments: [{ id: 'visual-usage', title: 'Vitamin D', status: 'active' }],
  });
  await page.goto('/treatment/visual-usage');
  await page.getByTestId('treatment-usage-start').click();
  await page.getByTestId('save-usage-button').waitFor();
  await takeSnapshot(page, 'Treatment usage - Start taking', testInfo);
  await seedTestResources(page, {
    treatmentUsage: [
      { treatmentId: 'visual-usage', action: 'start', date: '2026-10-01' },
    ],
  });
  await page.goto('/treatment/visual-usage');
  await page.getByTestId('treatment-usage-stop').click();
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-usage-notes').click();
  await page
    .getByTestId('treatment-usage-notes-input')
    .fill('Waiting for a refill');
  await takeSnapshot(
    page,
    'Treatment usage - Stop taking with notes',
    testInfo
  );
  await page.getByTestId('treatment-usage-kind-stop').click();
  await takeSnapshot(page, 'Treatment usage - Stopped selection', testInfo);
  await seedTestResources(page, {
    treatmentUsage: [
      {
        treatmentId: 'visual-usage',
        action: 'pause',
        date: '2026-10-06',
        notes: 'Waiting for a refill',
      },
    ],
  });
  await page.goto('/treatment/visual-usage');
  await page.getByTestId('treatment-usage-start').click();
  await page.getByTestId('save-usage-button').waitFor();
  await takeSnapshot(page, 'Treatment usage - Resume taking', testInfo);
});
