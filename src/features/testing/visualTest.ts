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

/** Waits two frames, so layout and resize handlers have settled. */
const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

const PAGE_HEIGHT_STYLE_ID = 'visual-test-page-height';

/**
 * Makes the page as tall as its content, never shorter than the viewport.
 * Screens scroll inside their own containers, so a snapshot would otherwise
 * show only the first screenful. The viewport keeps its size, so each
 * snapshot keeps its Chromatic mode (w360h740) and baseline.
 */
async function growPageToContent(page: Page) {
  // A few rounds, as a taller page can render more (e.g. lists).
  for (let round = 0; round < 5; round++) {
    const hidden = await page.evaluate(() =>
      Math.max(
        0,
        ...[...document.querySelectorAll<HTMLElement>('*')]
          .filter(
            (element) =>
              element.clientHeight > 0 &&
              /auto|scroll/.test(getComputedStyle(element).overflowY)
          )
          .map((element) => element.scrollHeight - element.clientHeight)
      )
    );
    if (hidden <= 1) return;
    await page.evaluate(
      ({ id, hidden }) => {
        let style = document.getElementById(id);
        if (!style) {
          style = document.createElement('style');
          style.id = id;
          document.head.appendChild(style);
        }
        const height =
          Number(style.dataset.height || window.innerHeight) +
          Math.ceil(hidden);
        style.dataset.height = String(height);
        style.textContent = `html, body, #root { height: ${height}px !important; }`;
      },
      { id: PAGE_HEIGHT_STYLE_ID, hidden }
    );
    await nextFrames(page);
  }
}

/** Returns the page to the viewport's height for the rest of the test. */
async function resetPageHeight(page: Page) {
  await page.evaluate(
    (id) => document.getElementById(id)?.remove(),
    PAGE_HEIGHT_STYLE_ID
  );
  await nextFrames(page);
}

/**
 * Captures a Chromatic snapshot of the whole page: the page grows to fit its
 * content for the snapshot, then returns to the viewport's height. Set
 * `VISUAL_PNG_DIR` to also save a local full-page PNG per snapshot, for
 * comparing states without publishing.
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
  await growPageToContent(page);
  await takeChromaticSnapshot(page, name, testInfo);
  const pngDir = process.env.VISUAL_PNG_DIR;
  if (pngDir) {
    const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await page.screenshot({ path: `${pngDir}/${file}.png`, fullPage: true });
  }
  await resetPageHeight(page);
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

/**
 * Waits for the sync the app starts when it loads with a synced profile to
 * finish, and its header checkmark to clear. Checking only for no indicator
 * passes before that sync has started.
 */
export async function waitForSyncIdle(page: Page): Promise<void> {
  await expect(page.getByTestId('sync-checkmark')).toBeVisible();
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
