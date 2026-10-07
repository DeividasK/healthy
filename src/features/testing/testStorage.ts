import { expect, type Page } from '@playwright/test';

/**
 * Resets all browser storage (localStorage, sessionStorage, and OPFS / IndexedDB files) for clean test runs.
 */
export async function clearAppStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    if (
      typeof (
        window as unknown as { __clearAllDatabaseTables?: () => Promise<void> }
      ).__clearAllDatabaseTables === 'function'
    ) {
      try {
        await (
          window as unknown as {
            __clearAllDatabaseTables?: () => Promise<void>;
          }
        ).__clearAllDatabaseTables!();
      } catch {
        // Ignore table wipe error if database not initialized yet
      }
    }
  });
}

/**
 * Creates a Patient profile through standard UI flow.
 */
export async function createPatientViaUI(
  page: Page,
  options: {
    givenName?: string;
    familyName?: string;
  } = {}
): Promise<void> {
  await page.goto('/profile/new');
  await expect(page.getByTestId('add-profile-header-title')).toBeVisible();
  const givenNameInput = page.getByTestId('patient-given-name-input');
  await expect(givenNameInput).toBeVisible();
  const nameToFill = options.givenName || 'Self';
  await givenNameInput.click();
  await givenNameInput.fill(nameToFill);
  await expect(givenNameInput).toHaveValue(nameToFill);

  if (options.familyName) {
    const familyNameInput = page.getByTestId('patient-family-name-input');
    await familyNameInput.click();
    await familyNameInput.fill(options.familyName);
    await expect(familyNameInput).toHaveValue(options.familyName);
  }
  const saveBtn = page.getByTestId('save-profile-button');
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();
  await expect(page).not.toHaveURL(/.*profile\/new/);
}

/**
 * Seeds a DiagnosticReport through standard UI creation flow without exposing private app internals.
 */
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
  const fab = page.getByTestId('floating-add-button');
  if (await fab.isVisible()) {
    await fab.click();
    await page.getByTestId('menu-add-condition').click();
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
