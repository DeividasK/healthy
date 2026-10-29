import type { Page } from '@playwright/test';
import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
} from '@/src/features/testing/visualTest';

// The visual fixture fixes today at 2026-10-08.
const REPLY = `\`\`\`json\n${JSON.stringify({
  healthyImport: 1,
  summary:
    'A physical medicine visit with one suspected diagnosis, two ordered services and a treatment.',
  records: [
    {
      type: 'consultation',
      ref: 'visit',
      source: '2. Visit details',
      title: 'Physical medicine consultation',
      date: '2026-10-07',
      time: '10:02',
      specialist: 'Dr. Ruth Moss',
      serviceProvider: 'City Clinic',
      serviceType: 'Physical medicine',
    },
    {
      type: 'condition',
      ref: 'knee',
      source: '3.4. Diagnoses',
      consultation: 'visit',
      name: 'Soft tissue overuse disorder',
      icd10: 'M70.8',
      verification: 'provisional',
      onset: '2026-09-30',
    },
    {
      type: 'serviceRequest',
      ref: 'physio',
      source: '3.11. Non-drug treatment',
      consultation: 'visit',
      conditions: ['knee'],
      service: 'Physiotherapist consultation',
      category: 'Referral',
      intent: 'order',
      date: '2026-10-07',
    },
    {
      type: 'serviceRequest',
      ref: 'sessions',
      source: '3.11. Non-drug treatment',
      consultation: 'visit',
      conditions: ['knee'],
      service: 'Individual physiotherapy',
      category: 'Procedure',
      intent: 'order',
      repeats: { sessions: 5, minutes: 45 },
    },
    {
      type: 'treatment',
      ref: 'gel',
      source: '3.10. Medication',
      consultation: 'visit',
      conditions: ['knee'],
      name: 'Diclofenac 1% gel',
      intent: 'order',
      dosage: 'Apply to the knee twice a day',
    },
  ],
})}\n\`\`\``;

async function openReview(page: Page) {
  await page.goto('/');
  await page.getByTestId('home-import-with-ai-button').click();
  await page.getByTestId('ai-import-reply-input').fill(REPLY);
  await page.getByTestId('ai-import-submit-button').click();
  await page.getByTestId('ai-import-review').waitFor();
}

for (const desktop of [false, true]) {
  const layout = desktop ? 'desktop' : 'mobile';
  test.describe(`Import with AI review - ${layout}`, () => {
    test.beforeEach(async ({ page }) => {
      if (desktop) await page.setViewportSize({ width: 1280, height: 800 });
      await seedTestPatient(page);
    });

    test('rows to check, then some decided', async ({ page }, testInfo) => {
      await openReview(page);
      await takeSnapshot(page, `AI import review - ${layout}`, testInfo);
      await page.getByTestId('ai-import-row-not-taken-visit').click();
      await page.getByTestId('ai-import-row-taken-physio').click();
      await page.getByTestId('ai-import-row-not-taken-gel').click();
      await page
        .locator(
          '[data-testid="ai-import-row-not-taken-gel"][aria-checked="true"]'
        )
        .waitFor();
      await takeSnapshot(
        page,
        `AI import review - skipped visit - ${layout}`,
        testInfo
      );
    });

    test('a condition the patient already has', async ({ page }, testInfo) => {
      await seedTestCondition(page, {
        title: 'Soft tissue overuse disorder',
        onsetDate: '2026-09-30',
      });
      await openReview(page);
      await page.getByTestId('ai-import-row-knee-open').click();
      await page.getByTestId('ai-import-existing-knee').waitFor();
      await takeSnapshot(
        page,
        `AI import review - existing condition - ${layout}`,
        testInfo
      );
    });

    test('editing a proposed record', async ({ page }, testInfo) => {
      await openReview(page);
      await page.getByTestId('ai-import-row-physio-open').click();
      await page.getByTestId('service-request-title-input').waitFor();
      await takeSnapshot(
        page,
        `AI import - edit proposed service request - ${layout}`,
        testInfo
      );
    });
  });
}
