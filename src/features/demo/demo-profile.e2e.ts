import {
  test,
  expect,
  openRoute,
  bootstrapApp,
  seedTestPatient,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

/** How many rows of `table` belong to the active profile. */
const countForActive = (page: Parameters<typeof bridge>[0], table: string) =>
  bridge(
    page,
    async (b, table) => {
      const [{ id }] = await b.querySql(
        "SELECT value AS id FROM app_settings WHERE key = 'active_patient_id'"
      );
      const [{ n }] = await b.querySql(
        `SELECT COUNT(*) AS n FROM ${table} WHERE patient_id = ?`,
        [id]
      );
      return n as number;
    },
    table
  );

test.describe('Demo profile', () => {
  test('Welcome loads a demo profile with three years of records', async ({
    page,
  }) => {
    await test.step('Explore a demo from Welcome', async () => {
      await bootstrapApp(page);
      await bridge(page, (b) => b.navigate('/'));
      await expect(page).toHaveURL(/\/welcome$/);
      await page.getByTestId('welcome-demo').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
    });

    await test.step('Home shows the conditions, treatments and visits', async () => {
      const conditions = page.getByTestId('home-conditions-section');
      await expect(conditions.getByText('High cholesterol')).toBeVisible();
      await expect(conditions.getByText('Low iron')).toBeVisible();
      await expect(conditions.getByText('Low vitamin D')).toBeVisible();
      await expect(
        page
          .getByTestId('home-treatments-section')
          .getByText('Atorvastatin 20 mg')
      ).toBeVisible();
      await expect(
        page
          .getByTestId('home-consultations-section')
          .getByText('Cholesterol clinic visit')
      ).toBeVisible();
    });

    await test.step('The records span three years', async () => {
      expect(await countForActive(page, 'diagnostic_reports')).toBe(4);
      expect(await countForActive(page, 'conditions')).toBe(3);
      const [first, last] = await bridge(page, (b) =>
        b
          .querySql(
            'SELECT MIN(effective_date) AS first, MAX(effective_date) AS last FROM diagnostic_reports'
          )
          .then(([row]: any[]) => [row.first, row.last])
      );
      const years =
        (Date.parse(last) - Date.parse(first)) / (365 * 24 * 3600 * 1000);
      expect(years).toBeGreaterThan(2.9);
    });

    await test.step('The journal has past answers and today to answer', async () => {
      expect(
        await countForActive(page, 'medication_administrations')
      ).toBeGreaterThan(40);
      await openRoute(page, '/journal');
      await expect(page.getByText('Morning stack')).toBeVisible();
      await expect(page.getByText('Evening medication')).toBeVisible();
      for (const activity of ['Meditation', 'Hyperbaric oxygen therapy (HBOT)'])
        await expect(
          page.getByRole('checkbox', { name: `Mark ${activity} done` })
        ).toBeVisible();
    });

    await test.step('The profile is the demo person', async () => {
      await openRoute(page, '/profile');
      await expect(page.getByTestId('profile-display-name')).toHaveText(
        'Alex Demo'
      );
    });
  });

  test('Add a profile loads the demo beside an existing profile', async ({
    page,
  }) => {
    await seedTestPatient(page, { givenName: 'Jane' });
    await openRoute(page, '/profile/new');
    await page.getByTestId('add-profile-demo').click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
    await expect(
      page.getByTestId('home-conditions-section').getByText('Low vitamin D')
    ).toBeVisible();
    const names = await bridge(page, (b) =>
      b.querySql('SELECT id FROM patients')
    );
    expect(names).toHaveLength(2);
  });
});
