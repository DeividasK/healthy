import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test, takeSnapshot } from '@/src/features/testing/visualTest';

/** The landing page in site/, served by the test instead of GitHub Pages. */
const SITE_PATH = '/__site/';
const SITE_DIR = path.join(process.cwd(), 'site');
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

test.describe('Landing page - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**${SITE_PATH}**`, async (route) => {
      const file = new URL(route.request().url()).pathname.slice(
        SITE_PATH.length
      );
      await route.fulfill({
        body: await readFile(path.join(SITE_DIR, file || 'index.html')),
        contentType: CONTENT_TYPES[path.extname(file || '.html')],
      });
    });
  });

  for (const { name, viewport } of [
    { name: 'Mobile', viewport: null },
    { name: 'Desktop', viewport: { width: 1280, height: 900 } },
  ]) {
    test(`Landing page - ${name}`, async ({ page }, testInfo) => {
      if (viewport) await page.setViewportSize(viewport);
      await page.goto(SITE_PATH);
      await page.evaluate(() => document.fonts.ready);
      await page
        .locator('img')
        .evaluateAll((images) =>
          Promise.all(
            images.map((image) => (image as HTMLImageElement).decode())
          )
        );
      await takeSnapshot(page, `Landing page - ${name}`, testInfo);
    });
  }
});
