import { test, takeSnapshot } from '@/src/features/testing/visualTest';

test.describe('Not Found View - Visual Regression', () => {
  test('Not Found View - 404 Screen', async ({ page }, testInfo) => {
    await page.goto('/some-non-existent-page');
    await page.getByText("This screen doesn't exist.").waitFor();

    await takeSnapshot(page, 'Not Found View - 404 Screen', testInfo);
  });
});
