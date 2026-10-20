import {
  test as chromaticTest,
  takeSnapshot as takeChromaticSnapshot,
} from '@chromatic-com/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';
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
 *
 * Snapshots show no focused or hovered field. Chromatic re-renders the
 * captured page and does not reliably keep focus, so a focus ring would land
 * on different fields between builds. Pass `keepFocus` only when the snapshot
 * is about a focus-driven state (a keyboard focus ring, an open autocomplete).
 */
export async function takeSnapshot(
  page: Page,
  name: string,
  testInfo: TestInfo,
  { keepFocus = false }: { keepFocus?: boolean } = {}
): Promise<void> {
  // The journal's day strip renders the days in view first and the older
  // ones after. Chromatic replays the page scrolled to the strip's start, so
  // wait for its first cell.
  if (await page.getByTestId('actions-week-pager').count())
    await page
      .getByTestId('actions-open-calendar')
      .waitFor({ state: 'attached' });
  // A resting pointer leaves hover styles on whatever is now under it.
  await page.mouse.move(0, 0);
  if (!keepFocus) {
    // Dialogs move focus in once they are ready, which under load can come
    // after a first blur; blur until nothing takes focus back.
    const blurAll = () =>
      expect
        .poll(() =>
          page.evaluate(() => {
            (document.activeElement as HTMLElement | null)?.blur();
            return document.querySelector(':focus') === null;
          })
        )
        .toBe(true);
    await blurAll();
    // Blur handlers close suggestion lists after a short delay (useDismissOnBlur).
    await page.waitForTimeout(200);
    await blurAll();
  }
  await takeChromaticSnapshot(page, name, testInfo);
  const pngDir = process.env.VISUAL_PNG_DIR;
  if (pngDir) {
    const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await page.screenshot({ path: `${pngDir}/${file}.png`, fullPage: true });
  }
}
/**
 * Waits until a dock menu toggle has settled open (x) or closed (+), so a
 * snapshot never catches the menu's state mid-update.
 */
export async function waitForMenuToggle(
  page: Page,
  testId: string,
  expanded: boolean
): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveAttribute(
    'aria-expanded',
    String(expanded)
  );
}

/** Waits for a sync round to finish and its header checkmark to clear. */
export async function waitForSyncIdle(page: Page): Promise<void> {
  await expect(page.getByTestId('sync-header-indicator')).toHaveCount(0);
}

export {
  seedTestPatient,
  seedTestResources,
  seedTestReport,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  getTestTreatment,
  seedTestServiceRequest,
  seedTestBundle,
} from './testStorage';
