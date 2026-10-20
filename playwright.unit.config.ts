import { defineConfig } from '@playwright/test';

// Pure TypeScript tests reuse the runner without starting Expo or a browser.
export default defineConfig({
  testDir: './src/features',
  testMatch: /.*\.unit\.ts/,
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  outputDir: 'test-results/unit',
});
