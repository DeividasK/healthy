import {
  test,
  takeSnapshot,
  seedTestBundle,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';

test.describe('View Bundle - Visual Regression', () => {
  test('Bundle with its treatments', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'visual-bundle-vit-d',
          title: 'Vitamin D 1000 IU',
          status: 'active',
          authoredOn: '2026-09-20',
        },
        {
          id: 'visual-bundle-omega',
          title: 'Omega-3 1g',
          status: 'active',
          authoredOn: '2026-09-20',
        },
      ],
    });
    const bundle = await seedTestBundle(page, {
      title: 'Morning supplements',
      times: ['MORN', '20:00'],
      memberIds: ['visual-bundle-vit-d', 'visual-bundle-omega'],
    });
    await page.goto(`/bundle/${bundle.id}`);
    await page.getByTestId('bundle-treatment-visual-bundle-omega').waitFor();
    await takeSnapshot(page, 'Bundle - View', testInfo);
  });
});
