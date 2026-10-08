import { expect, type Page } from '@playwright/test';

export const DEFAULT_PROFILE_FIRST_NAME = 'John';
export const DEFAULT_PROFILE_LAST_NAME = 'Doe';

/**
 * Resets browser storage (localStorage and sessionStorage) for clean test runs.
 */
export async function clearAppStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('html[data-app-ready="true"]').waitFor({ timeout: 10000 });
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    // Clear Origin Private File System (where expo-sqlite / wa-sqlite persists databases)
    if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
      try {
        const root = await navigator.storage.getDirectory();
        for await (const [name, handle] of root.entries()) {
          try {
            await root.removeEntry(name, {
              recursive: handle.kind === 'directory',
            });
          } catch {
            // Ignore individual handle delete error
          }
        }
      } catch {
        // Ignore OPFS access errors in restricted contexts
      }
    }

    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      } catch {
        // Ignore indexedDB deletion errors
      }
    }
  });
}

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
export async function createPatientViaUI(
  page: Page,
): Promise<void> {
  await page.goto('/profile/new');
  await page.locator('html[data-app-ready="true"]').waitFor({ timeout: 10000 });
  await page.getByTestId('patient-given-name-input').fill(DEFAULT_PROFILE_FIRST_NAME);
  await page.getByTestId('patient-family-name-input').fill(DEFAULT_PROFILE_LAST_NAME);
  await page.getByTestId('save-profile-button').click();
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
  await page.goto('/lab-result/add');

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
    const plusBtn = page.getByTestId('plus-menu-button');
    if (await plusBtn.isVisible()) {
      await plusBtn.click();
      const notesOption = page.getByTestId('menu-add-notes');
      if (await notesOption.isVisible()) {
        await notesOption.click();
      }
    }
    const notesInput = page.getByTestId('notes-input');
    await notesInput.fill(options.notes);
  }

  await page.getByTestId('save-button').click();
  await page.waitForURL(/.*(\/|#)$/);
}

/**
 * Seeds a Condition through standard UI creation flow without exposing private app internals.
 */
export async function createConditionViaUI(
  page: Page,
  options: {
    title: string;
    status?: string;
    notes?: string;
  }
): Promise<void> {
  const fab = page.getByTestId('floating-add-button').first();
  if (await fab.isVisible()) {
    await fab.click();
    await page.getByTestId('menu-add-condition').first().click();
  } else {
    await page.goto('/condition/add');
  }

  await page.waitForURL(/.*condition\/add/);
  await page.getByTestId('condition-title-input').waitFor({ state: 'visible' });

  if (options.status) {
    const statusSelect = page.getByTestId('status-picker-select');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption(options.status);
    }
  }

  await page.getByTestId('condition-title-input').fill(options.title);

  if (options.notes) {
    const addOptionBtn = page.getByTestId('add-option-button');
    if (await addOptionBtn.isVisible()) {
      await addOptionBtn.click();
      const addNotesOption = page.getByTestId('menu-add-notes');
      if (await addNotesOption.isVisible()) {
        await addNotesOption.click();
      }
    }
    const notesInput = page.getByTestId('condition-notes-input');
    await notesInput.fill(options.notes);
  }

  await page.getByTestId('save-button').click();
  await page.waitForURL(/.*(\/|#)$/);
}
