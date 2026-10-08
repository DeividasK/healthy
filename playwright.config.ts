import { defineConfig, devices } from '@playwright/test';
import type { ChromaticConfig } from '@chromatic-com/playwright';

export default defineConfig<ChromaticConfig>({
  testDir: './src/features',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8089',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.e2e\.ts/,
    },
    {
      name: 'visual',
      use: {
        viewport: { width: 360, height: 740 },
        colorScheme: 'light',
        disableAutoSnapshot: true,
      },
      testMatch: /.*\.visual\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm expo start --web --port 8089',
    url: 'http://localhost:8089',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
