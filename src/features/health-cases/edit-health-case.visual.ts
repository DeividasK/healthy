import { test, expect, takeSnapshot } from '@chromatic-com/playwright';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

async function seedHealthCase(
  page: any,
  caseItem: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    description?: string;
  }
) {
  await page.goto('/');
  await page.evaluate((c: any) => {
    localStorage.clear();
    sessionStorage.clear();
    const casesObj: Record<string, any> = {};
    const episode = {
      resourceType: 'EpisodeOfCare',
      id: c.id,
      status: c.status,
      period: { start: c.startDate },
      type: [{ text: c.title }],
      diagnosis: [{ condition: { display: c.title } }],
      description: c.title,
      note: c.description
        ? [{ text: c.description, time: '2026-10-02T10:00:00.000Z' }]
        : undefined,
    };
    casesObj[c.id] = {
      id: c.id,
      status: c.status,
      start_date: c.startDate,
      title: c.title,
      description: c.description || null,
      fhir_json: JSON.stringify(episode),
      created_at: '2026-10-02T10:00:00.000Z',
      updated_at: '2026-10-02T10:00:00.000Z',
    };
    localStorage.setItem(
      '@healthy_episodes_of_care_v1',
      JSON.stringify(casesObj)
    );
  }, caseItem);
}

test.describe('Edit Health Case View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Health Case View - Edit Existing Mode', async ({ page }, testInfo) => {
    await seedHealthCase(page, {
      id: 'case-visual-1',
      title: 'Left Knee Pain',
      status: 'active',
      startDate: '2026-10-02',
      description: 'Persistent ache after running on tarmac.',
    });

    await page.goto('/health-case/case-visual-1/edit');

    await expect(page.getByText('Edit Health Case')).toBeVisible();
    await expect(page.getByTestId('case-title-input')).toHaveValue(
      'Left Knee Pain'
    );
    await expect(page.getByTestId('case-description-input')).toHaveValue(
      'Persistent ache after running on tarmac.'
    );

    await takeSnapshot(page, 'Health Case View - Edit Existing Mode', testInfo);
  });
});
