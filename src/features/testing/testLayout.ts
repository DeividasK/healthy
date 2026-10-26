import type { Page } from '@playwright/test';

/** Windows this wide get the desktop layout: sidebar and side-by-side columns. */
const DESKTOP_MIN_WIDTH = 1200;

/**
 * Narrows a desktop window to the single-column layout (header, one column)
 * for tests about that layout; phones and tablets already have it. The next
 * test gets its project's viewport back.
 */
export async function useSingleColumnLayout(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= DESKTOP_MIN_WIDTH)
    await page.setViewportSize({ width: 1024, height: viewport.height });
}

/** The area screens use: the window, less the desktop sidebar. */
export async function getContentArea(
  page: Page
): Promise<{ x: number; width: number }> {
  const windowWidth = page.viewportSize()!.width;
  const sidebar = page.getByTestId('app-sidebar');
  if (!(await sidebar.isVisible())) return { x: 0, width: windowWidth };
  const box = (await sidebar.boundingBox())!;
  const x = box.x + box.width;
  return { x, width: windowWidth - x };
}

/** Where the dock centres its main action. */
export async function getContentCenterX(page: Page): Promise<number> {
  const { x, width } = await getContentArea(page);
  return x + width / 2;
}

/** The centred column a screen's content sits in. */
export async function getContentColumn(
  page: Page
): Promise<{ x: number; width: number }> {
  const area = await getContentArea(page);
  const width = Math.min(800, area.width);
  return { x: area.x + (area.width - width) / 2, width };
}
