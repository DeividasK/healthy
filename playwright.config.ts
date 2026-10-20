import { defineConfig, devices } from '@playwright/test';
import type { ChromaticConfig } from '@chromatic-com/playwright';

export default defineConfig<ChromaticConfig>({
  testDir: './src/features',
  globalSetup: './src/features/testing/globalSetup.ts',
  fullyParallel: true,
  // Locally one worker per core measured fastest: with the app booted once
  // per worker, tests no longer saturate the CPU while the dev server works.
  workers: process.env.CI ? '75%' : '100%',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30000,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ...(process.env.PLAYWRIGHT_BLOB_REPORT ? [['blob'] as const] : []),
  ],
  use: {
    baseURL: 'http://localhost:8089',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
      testMatch: /.*\.e2e\.ts/,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /.*\.e2e\.ts/,
    },
    {
      name: 'visual',
      use: {
        viewport: { width: 360, height: 740 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
        disableAutoSnapshot: true,
        // Chromatic archives a test's resources once the network is idle.
        // Its snapshot script resets Playwright's idle state, which after
        // in-app navigation only returns at the 10 s default. Snapshots
        // wait for their content, so everything is loaded by then.
        resourceArchiveTimeout: 1500,
      },
      testMatch: /.*\.visual\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm expo start --web --port 8089',
    env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'playwright-synthetic-client' },
    url: 'http://localhost:8089',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
