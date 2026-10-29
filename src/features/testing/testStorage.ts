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

/**
 * A booted app a worker reuses across tests: the `page` fixture's, and a
 * spare second device for `openSecondDevice`.
 */
interface SharedApp {
  context?: BrowserContext;
  page?: Page;
  /** The context options it was created with. */
  options?: string;
  /** Whether the current test fixed, paused or set the fake clock. */
  clockChanged?: boolean;
  /** Documents the current test loaded after the app had booted. */
  loads?: number;
  countLoad?: () => void;
}

/**
 * The shared app runs on Playwright's fake clock from the start, so tests
 * can fast-forward (e.g. a delete countdown) without a reboot afterwards;
 * time otherwise flows as usual. Fixing, pausing or setting the time marks
 * the app for discarding.
 */
async function installSharedClock(
  context: BrowserContext,
  shared: SharedApp
): Promise<void> {
  const clock = context.clock;
  await clock.install();
  for (const method of ['setFixedTime', 'pauseAt', 'setSystemTime'] as const) {
    const original = clock[method].bind(clock) as (
      ...args: unknown[]
    ) => Promise<void>;
    clock[method] = ((...args: unknown[]) => {
      shared.clockChanged = true;
      return original(...args);
    }) as never;
  }
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

async function discardSharedApp(app: SharedApp): Promise<void> {
  await app.context?.close();
  app.context = app.page = undefined;
}

/**
 * Returns the shared app reset in place (empty database and storage,
 * providers and screens remounted, on the new-profile screen a fresh page
 * also opens on), or a new page when there is none to reuse.
 */
async function acquireSharedApp(
  app: SharedApp,
  createContext: () => Promise<BrowserContext>,
  options: string,
  viewport: { width: number; height: number } | null
): Promise<Page> {
  if (app.options !== options) await discardSharedApp(app);
  if (app.page && app.page.url() !== 'about:blank') {
    const page = app.page;
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
    if (!reset) await discardSharedApp(app);
  }
  if (!app.page) {
    app.context = await createContext();
    await installSharedClock(app.context, app);
    app.page = await app.context.newPage();
    app.options = options;
    await mockGoogleIdentityServices(app.page);
  }
  const page = app.page;
  app.clockChanged = false;
  // A test that loads the page again leaves another document in its
  // history, which a later back navigation would reload into.
  app.loads = page.url() === 'about:blank' ? -1 : 0;
  app.countLoad = () => app.loads!++;
  page.on('domcontentloaded', app.countLoad);
  return page;
}

/**
 * Keeps the shared app for the next test, or discards it after a failure,
 * a reload, a fixed or paused clock, or other tabs.
 */
async function releaseSharedApp(
  app: SharedApp,
  passed: boolean
): Promise<void> {
  const page = app.page!;
  page.off('domcontentloaded', app.countLoad!);
  for (const event of TEST_EVENTS) page.removeAllListeners(event);
  if (
    !passed ||
    app.loads! > 0 ||
    page.isClosed() ||
    app.context!.pages().length !== 1 ||
    app.clockChanged
  ) {
    await discardSharedApp(app);
  } else {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await app.context!.unrouteAll({ behavior: 'ignoreErrors' });
    // e.g. clipboard access a test granted.
    await app.context!.clearPermissions();
  }
}

export const test = baseTest.extend<
  { consoleMonitor: ConsoleMonitor; freshApp: boolean },
  { sharedApp: SharedApp }
>({
  /**
   * Gives the test a page of its own instead of the worker's shared app:
   * for tests about loading, other tabs, or browser state a reset cannot
   * clear. A test can also opt out with the `@fresh-app` tag.
   */
  freshApp: [false, { option: true }],
  sharedApp: [
    // eslint-disable-next-line no-empty-pattern -- Playwright reads fixture dependencies from the pattern
    async ({}, use) => {
      const shared: SharedApp = {};
      await use(shared);
      await shared.context?.close();
      await spareDevice.context?.close();
    },
    { scope: 'worker' },
  ],
  /**
   * Booting the app (bundle parse, SQLite and migrations) costs more CPU
   * than most tests, so a worker boots it once and resets it in place before
   * each test (see `acquireSharedApp`).
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
      await discardUnclosedDevice();
      return;
    }
    const options = JSON.stringify({
      viewport,
      reducedMotion,
      isMobile,
      hasTouch,
      colorScheme,
    });
    const page = await acquireSharedApp(
      sharedApp,
      () => browser.newContext(),
      options,
      viewport
    );
    await providePage(page);
    await releaseSharedApp(
      sharedApp,
      testInfo.status === testInfo.expectedStatus
    );
    await discardUnclosedDevice();
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

/** The worker's second device, reused across tests like the shared app. */
const spareDevice: SharedApp & { inUse?: boolean } = {};

/** A test that failed before closing its second device leaves it open. */
async function discardUnclosedDevice(): Promise<void> {
  if (!spareDevice.inUse) return;
  await discardSharedApp(spareDevice);
  spareDevice.inUse = false;
}

/**
 * Opens another browser context: a separate device with its own SQLite
 * database and key storage. Close it with the returned function. The first
 * device a test opens is the worker's spare, reset in place.
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
  const contextOptions = {
    baseURL,
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    reducedMotion,
  };
  const createContext = () => browser.newContext(contextOptions);
  const app: SharedApp & { inUse?: boolean } = spareDevice.inUse
    ? {}
    : spareDevice;
  app.inUse = true;
  const page = await acquireSharedApp(
    app,
    createContext,
    JSON.stringify(contextOptions),
    viewport ?? null
  );
  const monitor = setupConsoleMonitor(page);
  return {
    page,
    close: async () => {
      monitor.assertNoErrors();
      if (app === spareDevice) {
        await releaseSharedApp(app, true);
        app.inUse = false;
      } else {
        await discardSharedApp(app);
      }
    },
  };
}

export const DEFAULT_PROFILE_FIRST_NAME = 'John';
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
 * Sets up the first profile the way a new user does: Welcome, then a name.
 */
export async function createPatientViaUI(page: Page): Promise<void> {
  // A device with no profile starts at Welcome.
  await page.goto('/');
  await page.getByTestId('welcome-get-started').click();
  await page.getByTestId('welcome-name-input').fill(DEFAULT_PROFILE_FIRST_NAME);
  await page.getByTestId('welcome-name-continue').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('start-your-record')).toBeVisible();
}

export interface AddConditionOptions {
  title?: string;
  status?: string;
  notes?: string;
}

/**
 * Creates a Condition through standard UI flow starting from the homepage:
 * its starter row while Home is empty, else the + menu.
 */
export async function createTestConditionViaUI(
  page: Page,
  options?: AddConditionOptions
): Promise<void> {
  const plus = page.getByTestId('floating-add-button');
  const starter = page.getByTestId('start-condition');
  await expect(plus.or(starter)).toBeVisible();
  if (await starter.isVisible()) {
    await starter.click();
  } else {
    await plus.click();
    await page.getByTestId('menu-add-condition').click();
  }
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
export * from './testLayout';
export * from './testDataFactory';
export * from './testSections';
