import {
  test as chromaticTest,
  takeSnapshot as takeChromaticSnapshot,
} from '@chromatic-com/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { mockGoogleIdentityServices } from './mockGoogleDrive';

export const VISUAL_TEST_FIXED_DATE = new Date('2026-10-08T10:00:00Z');

/**
 * Custom test fixture for Chromatic visual regression tests.
 * Automatically installs and sets a deterministic fixed date/time
 * on the browser page before navigation or tests run.
 */
export const test = chromaticTest.extend({
  page: async ({ page }, providePage) => {
    await mockGoogleIdentityServices(page);
    // Expo's dev-server bundle-loading badge appears depending on lazy bundling timing.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent =
          '.__expo_fast_refresh { display: none !important; }';
        document.head.appendChild(style);
      });
    });
    await page.clock.setFixedTime(VISUAL_TEST_FIXED_DATE);
    await providePage(page);
  },
});

/**
 * Captures a Chromatic snapshot. Set `VISUAL_PNG_DIR` to also save a local
 * full-page PNG per snapshot, for comparing states without publishing.
 */
export async function takeSnapshot(
  page: Page,
  name: string,
  testInfo: TestInfo
): Promise<void> {
  await takeChromaticSnapshot(page, name, testInfo);
  const pngDir = process.env.VISUAL_PNG_DIR;
  if (pngDir) {
    const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await page.screenshot({ path: `${pngDir}/${file}.png`, fullPage: true });
  }
}
export {
  seedTestPatient,
  seedTestResources,
  seedTestReport,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  getTestTreatment,
} from './testStorage';
