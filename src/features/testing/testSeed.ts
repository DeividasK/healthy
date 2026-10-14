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
  terminology?: { system?: string; code?: string; display?: string };
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

export interface SeedConsultationOptions {
  reasonConditionIds?: string[];
  id?: string;
  patientId?: string;
  conditionIds?: string[];
  title: string;
  doctorName?: string;
  serviceType?: string;
  date?: string;
  notes?: string;
  status?: string;
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
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
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

/**
 * Seeds a Consultation directly into SQLite via the test bridge.
 */
export async function seedTestConsultation(
  page: Page,
  options: SeedConsultationOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedConsultation(opts);
  }, options);
}

/**
 * Fetches the Composition linked to a Consultation directly via the test bridge.
 */
export async function getTestClinicalDocument(
  page: Page,
  consultationId: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (id) => {
    return await (
      window as any
    ).__HEALTHY_TEST_BRIDGE__.getClinicalDocumentByConsultationId(id);
  }, consultationId);
}
