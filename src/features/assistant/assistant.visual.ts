import {
  test,
  takeSnapshot,
  seedTestPatient,
} from '@/src/features/testing/visualTest';
import { mockAssistant } from '@/src/features/testing/mockAssistant';

test.describe('Assistant - Visual Regression', () => {
  test('Download', async ({ page }, testInfo) => {
    await mockAssistant(page);
    await seedTestPatient(page);
    await page.goto('/assistant');
    await page.getByTestId('assistant-download-button').waitFor();
    await takeSnapshot(page, 'Assistant - Download', testInfo);
  });

  test('Loading', async ({ page }, testInfo) => {
    await mockAssistant(page, { holdLoad: true });
    await seedTestPatient(page);
    await page.goto('/assistant');
    await page.getByTestId('assistant-download-button').click();
    await page.getByText('420 MB of 1.0 GB · 42%').waitFor();
    await takeSnapshot(page, 'Assistant - Loading', testInfo);
  });

  test('Conversation', async ({ page }, testInfo) => {
    await mockAssistant(page, { downloaded: ['qwen3-1.7b'] });
    await seedTestPatient(page);
    await page.goto('/assistant');
    const input = page.getByTestId('assistant-message-input');
    await input.fill('Which treatments am I taking?');
    await input.press('Enter');
    await page.getByText('You asked: Which treatments am I taking?').waitFor();
    await takeSnapshot(page, 'Assistant - Conversation', testInfo);
  });
});
