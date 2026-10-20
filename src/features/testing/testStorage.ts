import {
  test as baseTest,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { mockGoogleIdentityServices } from './mockGoogleDrive';

export { expect };

export interface ConsoleMonitor {
  /**
   * Temporarily ignores specific error or warning message substrings or RegExp patterns
   * for the duration of the current test.
   */
  ignore: (...patterns: (string | RegExp)[]) => void;
  assertNoErrors: () => void;
  getErrors: () => string[];
  getWarnings: () => string[];
}

/** A booted app a worker reuses across tests (see the `page` fixture). */
interface SharedApp {
  context?: BrowserContext;
  page?: Page;
  /** The context options it was created with. */
  options?: string;
}

/** Listeners a test may add that must not reach the next test. */
const TEST_EVENTS = [
  'console',
  'pageerror',
  'dialog',
  'download',
  'filechooser',
  'popup',
  'request',
  'response',
] as const;

export const test = baseTest.extend<
  { consoleMonitor: ConsoleMonitor; freshApp: boolean },
  { sharedApp: SharedApp }
>({
  /**
   * Gives the test a page of its own instead of the worker's shared app:
   * for tests about loading, other tabs or devices, or browser state a
   * reset cannot clear. A test can also opt out with the `@fresh-app` tag.
   */
  freshApp: [false, { option: true }],
  sharedApp: [
    // eslint-disable-next-line no-empty-pattern -- Playwright reads fixture dependencies from the pattern
    async ({}, use) => {
      const shared: SharedApp = {};
      await use(shared);
      await shared.context?.close();
    },
    { scope: 'worker' },
  ],
  /**
   * Booting the app (bundle parse, SQLite and migrations) costs more CPU
   * than most tests, so a worker boots it once and resets it in place before
   * each test: empty database and storage, providers and screens remounted,
   * on the new-profile screen a fresh page also opens on. A failed test, a
   * reload, a fake clock or other tabs discard the shared app.
   */
  page: async (
    {
      browser,
      freshApp,
      sharedApp,
      viewport,
      reducedMotion,
      isMobile,
      hasTouch,
      colorScheme,
    },
    providePage,
    testInfo
  ) => {
    if (freshApp || testInfo.tags.includes('@fresh-app')) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await mockGoogleIdentityServices(page);
      await providePage(page);
      await context.close();
      return;
    }
    const options = JSON.stringify({
      viewport,
      reducedMotion,
      isMobile,
      hasTouch,
      colorScheme,
    });
    const discard = async () => {
      await sharedApp.context?.close();
      sharedApp.context = sharedApp.page = undefined;
    };
    if (sharedApp.options !== options) await discard();
    if (sharedApp.page && sharedApp.page.url() !== 'about:blank') {
      const page = sharedApp.page;
      const reset = await test
        .step('Reset app', async () => {
          if (viewport && !isEqualSize(page.viewportSize(), viewport))
            await page.setViewportSize(viewport);
          await page.mouse.move(0, 0);
          await page.evaluate(() =>
            (window as any).__HEALTHY_TEST_BRIDGE__.resetForTest()
          );
          await page.waitForURL('**/profile/new');
        })
        .then(
          () => true,
          () => false
        );
      if (!reset) await discard();
    }
    if (!sharedApp.page) {
      sharedApp.context = await browser.newContext();
      sharedApp.page = await sharedApp.context.newPage();
      sharedApp.options = options;
      await mockGoogleIdentityServices(sharedApp.page);
    }
    const page = sharedApp.page;
    // A test that loads the page again leaves another document in its
    // history, which a later back navigation would reload into.
    let loads = page.url() === 'about:blank' ? -1 : 0;
    const countLoad = () => loads++;
    page.on('domcontentloaded', countLoad);
    await providePage(page);
    page.off('domcontentloaded', countLoad);
    for (const event of TEST_EVENTS) page.removeAllListeners(event);
    const usedClock = await page
      .evaluate(() => '__pwClock' in globalThis)
      .catch(() => true);
    if (
      testInfo.status !== testInfo.expectedStatus ||
      loads > 0 ||
      page.isClosed() ||
      sharedApp.context!.pages().length !== 1 ||
      usedClock
    ) {
      await discard();
    } else {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await sharedApp.context!.unrouteAll({ behavior: 'ignoreErrors' });
    }
  },
  // The page's own context, shared or not.
  context: async ({ page }, provideContext) => {
    await provideContext(page.context());
  },
  consoleMonitor: [
    async ({ page }, use) => {
      const monitor = setupConsoleMonitor(page);
      await use(monitor);
      monitor.assertNoErrors();
    },
    { auto: true },
  ],
});

const isEqualSize = (
  a: { width: number; height: number } | null,
  b: { width: number; height: number }
) => a?.width === b.width && a?.height === b.height;

/**
 * Opens another browser context: a separate device with its own SQLite
 * database and key storage. Close it with the returned function.
 */
export async function openSecondDevice(
  browser: Browser,
  testInfo: TestInfo
): Promise<{ page: Page; close: () => Promise<void> }> {
  const {
    baseURL,
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    reducedMotion,
  } = testInfo.project.use;
  const context = await browser.newContext({
    baseURL,
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    reducedMotion,
  });
  const page = await context.newPage();
  await mockGoogleIdentityServices(page);
  const monitor = setupConsoleMonitor(page);
  return {
    page,
    close: async () => {
      monitor.assertNoErrors();
      await context.close();
    },
  };
}

export const DEFAULT_PROFILE_FIRST_NAME = 'John';
export const DEFAULT_PROFILE_LAST_NAME = 'Doe';
export const DEFAULT_CONDITION_TITLE = 'Test Condition';

/**
 * Deletes the active profile through the standard UI flow.
 */
export async function deleteActiveProfileViaUI(page: Page): Promise<void> {
  await page.goto('/profile');
  const editBtn = page.getByTestId('edit-profile-button').first();
  await expect(editBtn).toBeVisible();
  await editBtn.click();

  const deleteBtn = page.getByTestId('delete-profile-button');
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();

  const modal = page.getByTestId('delete-profile-modal');
  await expect(modal).toBeVisible();

  const confirmBtn = page.getByTestId('delete-modal-confirm-button');
  await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
  await confirmBtn.click();
}

/**
 * Creates a Patient profile through standard UI flow.
 */
export async function createPatientViaUI(page: Page): Promise<void> {
  // This redirects to new profile creation page
  await page.goto('/');
  await page
    .getByTestId('patient-given-name-input')
    .fill(DEFAULT_PROFILE_FIRST_NAME);
  await page
    .getByTestId('patient-family-name-input')
    .fill(DEFAULT_PROFILE_LAST_NAME);
  await page.getByTestId('save-profile-button').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('floating-add-button')).toBeVisible();
}

export interface AddConditionOptions {
  title?: string;
  status?: string;
  notes?: string;
}

/**
 * Creates a Condition through standard UI flow starting from the homepage.
 */
export async function createTestConditionViaUI(
  page: Page,
  options?: AddConditionOptions
): Promise<void> {
  await page.getByTestId('floating-add-button').click();
  await page.getByTestId('menu-add-condition').click();
  await page
    .getByTestId('condition-title-input')
    .fill(options?.title ?? DEFAULT_CONDITION_TITLE);

  if (options?.status) {
    await page.getByTestId('status-picker-select').selectOption(options.status);
  }

  if (options?.notes) {
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-notes').click();
    await page.getByTestId('condition-notes-input').fill(options.notes);
  }

  await page.getByTestId('save-button').click();
}

export const createConditionViaUI = createTestConditionViaUI;
export const addConditionViaUI = createTestConditionViaUI;

/**
 * Attaches a console and pageerror monitor to the page that tracks console errors and warnings.
 * Provides assertNoErrors to verify no unhandled errors or unexpected warnings occurred.
 */
export function setupConsoleMonitor(page: Page): ConsoleMonitor {
  const errors: string[] = [];
  const warnings: string[] = [];
  const testIgnoredPatterns: (string | RegExp)[] = [];

  /**
   * List of known, benign third-party library warning substrings to filter globally.
   * Every entry MUST document why it is ignored and when/if it can be removed.
   */
  const globalIgnoredPatterns = [
    // 1. 'props.pointerEvents is deprecated. Use style.pointerEvents'
    // - Why: react-native-web (0.21.0+) deprecated the JSX `pointerEvents` prop on <View> in favor of `style.pointerEvents`.
    //   Upstream navigation containers (@react-navigation, expo-router, react-native-screens) still pass `pointerEvents="box-none"`
    //   or `pointerEvents="auto"` to internal screen and header wrapper views during development (__DEV__ = true).
    //   Application code does not pass pointerEvents as a prop anywhere.
    // - When/if it can be removed: Can be removed once upstream Expo Router and React Navigation release updates
    //   that migrate all internal screen wrappers to `style.pointerEvents` (expected in Expo SDK 58+).
    'props.pointerEvents is deprecated. Use style.pointerEvents',
    // 2. '[Reanimated] Reduced motion setting is enabled on this device.'
    // - Why: E2E tests run with reduced motion so they do not wait out every
    //   transition; Reanimated logs this development-only notice once per page.
    //   Tests about motion opt back into full motion.
    // - When/if it can be removed: never needed in production builds.
    '[Reanimated] Reduced motion setting is enabled on this device.',
  ];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning') {
      if (!globalIgnoredPatterns.some((pattern) => text.includes(pattern))) {
        warnings.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  const isIgnored = (msg: string) =>
    testIgnoredPatterns.some((pattern) =>
      typeof pattern === 'string' ? msg.includes(pattern) : pattern.test(msg)
    );

  return {
    ignore: (...patterns: (string | RegExp)[]) => {
      testIgnoredPatterns.push(...patterns);
    },
    assertNoErrors: () => {
      const unignoredErrors = errors.filter((err) => !isIgnored(err));
      const unignoredWarnings = warnings.filter((warn) => !isIgnored(warn));
      expect(unignoredErrors).toEqual([]);
      expect(unignoredWarnings).toEqual([]);
    },
    getErrors: () => errors.filter((err) => !isIgnored(err)),
    getWarnings: () => warnings.filter((warn) => !isIgnored(warn)),
  };
}

export * from './testSeed';
export * from './testRecords';
export * from './mockGoogleDrive';
export * from './testA11y';
export * from './testDataFactory';
