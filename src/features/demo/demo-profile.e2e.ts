import type { Browser, Page } from '@playwright/test';
import {
  test,
  expect,
  openRoute,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';
import { DEMO_BUILD_SESSION_KEY } from './demoBuild';

/** A tab of the demo build, in its own browser context. */
async function openDemoBuild(browser: Browser, baseURL?: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.addInitScript(
    (key) => sessionStorage.setItem(key, '1'),
    DEMO_BUILD_SESSION_KEY
  );
  await page.goto('/');
  return { context, page };
}

/** How many rows of `table` belong to the active profile. */
const countForActive = (page: Page, table: string) =>
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
  test('The demo build opens a demo profile with three years of records', async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openDemoBuild(browser, baseURL);
    try {
      await runDemoChecks(page);
    } finally {
      await context.close();
    }
  });

  test('The demo build keeps nothing and leaves the app free in another tab', async ({
    page,
    browser,
    baseURL,
  }) => {
    const demo = await openDemoBuild(browser, baseURL);
    try {
      await expect(
        demo.page.getByTestId('home-conditions-section')
      ).toBeVisible({ timeout: 20000 });

      await test.step('The app opens beside the demo', async () => {
        const app = await demo.context.newPage();
        await app.goto('/');
        await expect(app.getByTestId('welcome-get-started')).toBeVisible();
        await app.close();
      });

      await test.step('A reload starts a fresh demo', async () => {
        await demo.page.reload();
        await expect(
          demo.page.getByTestId('home-conditions-section')
        ).toBeVisible({ timeout: 20000 });
        const patients = await bridge(demo.page, (b) =>
          b.querySql('SELECT id FROM patients')
        );
        expect(patients).toHaveLength(1);
      });
    } finally {
      await demo.context.close();
    }

    await test.step('The app shows no demo profile', async () => {
      await openRoute(page, '/');
      await expect(page).toHaveURL(/\/welcome$/);
    });
  });
});

async function runDemoChecks(page: Page) {
  await test.step('The demo opens on Home', async () => {
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
    await expect(page.getByText('Supplement stack')).toBeVisible();
    await expect(page.getByText('Cholesterol medication')).toBeVisible();
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
}
