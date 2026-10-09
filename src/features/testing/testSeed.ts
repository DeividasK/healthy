import { type Page } from '@playwright/test';

export interface SeedPatientOptions {
  id?: string;
  givenName?: string;
  familyName?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  syncAccount?: string | null;
}

export interface SeedConditionOptions {
  id?: string;
  patientId?: string;
  title: string;
  status?: string;
  notes?: string;
  onsetDate?: string;
}

export interface SeedReportOptions {
  id?: string;
  patientId?: string;
  date?: string;
  notes?: string;
  biomarkers: {
    name: string;
    value: number | string;
    unit?: string;
  }[];
}

/**
 * Seeds a Patient directly into SQLite via the test bridge.
 */
export async function seedTestPatient(
  page: Page,
  options?: SeedPatientOptions
): Promise<any> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  const patient = await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedPatient({
      id: opts?.id,
      givenName: opts?.givenName || 'John',
      familyName: opts?.familyName || 'Doe',
      gender: opts?.gender,
      birthDate: opts?.birthDate,
      syncAccount: opts?.syncAccount,
    });
  }, options);
  if (page.url().includes('/profile/new')) {
    await page.goto('/');
  }
  return patient;
}

/**
 * Seeds a Condition directly into SQLite via the test bridge.
 */
export async function seedTestCondition(
  page: Page,
  options: SeedConditionOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedCondition(opts);
  }, options);
}

/**
 * Seeds a DiagnosticReport directly into SQLite via the test bridge.
 */
export async function seedTestReport(
  page: Page,
  options: SeedReportOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedReport(opts);
  }, options);
}
