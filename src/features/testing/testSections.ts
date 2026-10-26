import { expect, type Locator } from '@playwright/test';

/**
 * Opens every collapsed status group (Out of range, In range, ...) of the
 * biomarker lists inside `scope`; they start collapsed.
 */
export async function expandBiomarkerGroups(scope: Locator): Promise<void> {
  const collapsed = scope.locator(
    '[data-testid*="-groups-"][data-testid$="-toggle"][aria-expanded="false"]'
  );
  await expect(
    scope
      .locator(
        '[data-testid*="-groups-"][data-testid$="-toggle"][aria-expanded]'
      )
      .first()
  ).toBeVisible();
  while ((await collapsed.count()) > 0) await collapsed.first().click();
}
