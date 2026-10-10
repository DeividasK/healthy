import { test as chromaticTest, takeSnapshot } from '@chromatic-com/playwright';

export const VISUAL_TEST_FIXED_DATE = new Date('2026-10-08T10:00:00Z');

/**
 * Custom test fixture for Chromatic visual regression tests.
 * Automatically installs and sets a deterministic fixed date/time
 * on the browser page before navigation or tests run.
 */
export const test = chromaticTest.extend({
  page: async ({ page }, providePage) => {
    await page.clock.setFixedTime(VISUAL_TEST_FIXED_DATE);
    await providePage(page);
  },
});

export { takeSnapshot };
export {
  clearAppStorage,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  seedTestConsultation,
} from './testStorage';
