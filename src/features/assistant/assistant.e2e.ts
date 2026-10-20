import {
  test,
  expect,
  checkA11y,
  seedTestCondition,
  seedTestPatient,
  seedTestTreatment,
} from '@/src/features/testing/testStorage';
import { mockAssistant } from '@/src/features/testing/mockAssistant';

type Page = import('@playwright/test').Page;
const systemPrompt = (page: Page) =>
  page.evaluate(() => (window as any).__assistantSystemPrompt as string);
const loadedModel = (page: Page) =>
  page.evaluate(() => (window as any).__assistantModel as string);

test.describe('Assistant', () => {
  test('downloads the model and chats about the active profile', async ({
    page,
  }) => {
    await mockAssistant(page);
    await seedTestPatient(page);
    await seedTestCondition(page, {
      title: 'Asthma',
      notes: 'Worse in spring',
    });
    await seedTestTreatment(page, {
      title: 'Salbutamol',
      dosageInstructions: '2 puffs when needed',
    });

    await page.getByTestId('assistant-header-button').click();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(page.getByTestId('assistant-intro')).toContainText(
      'about 1 GB'
    );
    await checkA11y(page);

    // The smaller model is offered first.
    await expect(page.getByTestId('assistant-model')).toHaveValue('qwen3-1.7b');
    await page.getByTestId('assistant-download-button').click();
    await expect(page.getByTestId('assistant-empty')).toBeVisible();
    expect(await loadedModel(page)).toBe('qwen3-1.7b');

    // The model is told about this profile's records.
    const prompt = await systemPrompt(page);
    expect(prompt).toContain('Name: John Doe');
    expect(prompt).toContain('- Asthma');
    expect(prompt).toContain('notes: Worse in spring');
    expect(prompt).toContain('- Salbutamol');
    expect(prompt).toContain('dosage: 2 puffs when needed');

    const input = page.getByTestId('assistant-message-input');
    await expect(page.getByTestId('assistant-send-button')).toBeDisabled();
    await input.fill('When did my asthma start?');
    await input.press('Enter');
    await expect(page.getByTestId('assistant-message-user')).toHaveText(
      'When did my asthma start?'
    );
    // Reasoning tags are hidden from the reply.
    await expect(page.getByTestId('assistant-message-assistant')).toHaveText(
      'You asked: When did my asthma start?'
    );
    await expect(input).toHaveValue('');
    await checkA11y(page);

    await input.fill('And my treatments?');
    await page.getByTestId('assistant-send-button').click();
    await expect(page.getByTestId('assistant-message-assistant')).toHaveCount(
      2
    );

    await page.getByTestId('assistant-new-chat-button').click();
    await expect(page.getByTestId('assistant-empty')).toBeVisible();
    await expect(page.getByTestId('assistant-message-user')).toHaveCount(0);
  });

  test('loads a stored model straight away and switches models', async ({
    page,
  }) => {
    await mockAssistant(page, { downloaded: ['qwen3-1.7b'] });
    await seedTestPatient(page);
    await page.goto('/assistant');
    await expect(page.getByTestId('assistant-message-input')).toBeVisible();
    await expect(page.getByTestId('assistant-download-button')).toHaveCount(0);
    await expect(page.getByTestId('assistant-model')).toHaveValue('qwen3-1.7b');
    expect(await loadedModel(page)).toBe('qwen3-1.7b');
    expect(await systemPrompt(page)).toContain('No health records yet.');

    // The 4B model is not stored yet, so it waits for a download.
    await page.getByTestId('assistant-model').selectOption('qwen3-4b');
    await expect(page.getByTestId('assistant-intro')).toContainText(
      'about 2.3 GB'
    );
    await page.getByTestId('assistant-download-button').click();
    await expect(page.getByTestId('assistant-message-input')).toBeVisible();
    expect(await loadedModel(page)).toBe('qwen3-4b');

    // The choice is remembered.
    await page.reload();
    await expect(page.getByTestId('assistant-model')).toHaveValue('qwen3-4b');
  });

  test('explains when the browser cannot run the model', async ({ page }) => {
    await mockAssistant(page, { supported: false });
    await seedTestPatient(page);
    await page.goto('/assistant');
    await expect(page.getByTestId('assistant-unsupported')).toContainText(
      'WebGPU'
    );
    await expect(page.getByTestId('assistant-download-button')).toHaveCount(0);
  });
});
