import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestTreatment,
} from '@/src/features/testing/testStorage';

test.describe('View Condition', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('lists treatments associated with the condition and opens them', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, { title: 'Migraine' });
    const other = await seedTestCondition(page, { title: 'Back pain' });
    await page.goto(`/condition/${condition.id}`);
    await page.getByTestId('condition-title').waitFor();
    await expect(page.getByTestId('condition-treatments-section')).toHaveCount(
      0
    );

    const associated = await seedTestTreatment(page, {
      title: 'Sumatriptan 50mg',
      status: 'active',
      authoredOn: '2026-10-01',
      reasonConditionIds: [condition.id],
      requesterName: 'Dr. Julian Bashir',
    });
    await seedTestTreatment(page, {
      title: 'Ibuprofen 400mg',
      reasonConditionIds: [other.id],
    });
    await seedTestTreatment(page, { title: 'Vitamin D' });

    // Saved treatments appear without leaving the screen
    const section = page.getByTestId('condition-treatments-section');
    const item = page.getByTestId(`condition-treatment-item-${associated.id}`);
    const row = page.getByTestId(
      `condition-treatment-item-${associated.id}-row`
    );
    await expect(row).toContainText('Sumatriptan 50mg');
    await expect(row).toContainText('Dr. Julian Bashir');
    await expect(row).toContainText('Active');
    await expect(section.getByText('Ibuprofen 400mg')).toHaveCount(0);
    await expect(section.getByText('Vitamin D')).toHaveCount(0);

    await item.click();
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Sumatriptan 50mg'
    );
  });
});
