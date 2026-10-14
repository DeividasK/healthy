import { test as baseTest, expect, type Page } from '@playwright/test';
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

export const test = baseTest.extend<{ consoleMonitor: ConsoleMonitor }>({
  page: async ({ page }, providePage) => {
    await mockGoogleIdentityServices(page);
    await providePage(page);
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

export async function createReportViaUI(
  page: Page,
  options: {
    biomarkers: {
      name: string;
      value: string;
      unit?: string;
    }[];
    notes?: string;
  }
): Promise<void> {
  await page.getByTestId('floating-add-button').click();
  await page.getByTestId('menu-add-lab-results').click();

  for (let i = 0; i < options.biomarkers.length; i++) {
    const b = options.biomarkers[i];
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill(b.name);

    const option = page.locator('[data-testid^="autocomplete-item-"]').first();
    await option.click();

    const valInput = page.getByTestId(`marker-value-input-${i}`);
    await valInput.fill(b.value);

    if (b.unit) {
      const unitPicker = page.getByTestId(`marker-unit-select-${i}`);
      if (await unitPicker.isVisible()) {
        await unitPicker.selectOption(b.unit);
      }
    }
  }

  if (options.notes) {
    await page.getByTestId('plus-menu-button').click();
    await page.getByTestId('menu-add-notes').click();
    await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
    const notesInput = page.getByTestId('notes-input');
    await notesInput.fill(options.notes);
  }

  await page.getByTestId('save-button').click();
  await page.waitForURL(/.*(\/|#)$/);
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
export * from './mockGoogleDrive';
export * from './testA11y';
export * from './testDataFactory';
