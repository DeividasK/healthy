import { type Page } from '@playwright/test';
import type { MedicationRequest } from 'fhir/r5';

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

export interface SeedTreatmentOptions {
  id?: string;
  patientId?: string;
  consultationId?: string;
  title: string;
  intent?: MedicationRequest['intent'];
  status?: MedicationRequest['status'];
  authoredOn?: string;
  dosageInstructions?: string;
  reason?: string;
  reasonConditionIds?: string[];
  notes?: string;
  requesterName?: string;
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

/**
 * Seeds a Treatment (MedicationRequest) directly into SQLite via the test bridge.
 */
export async function seedTestTreatment(
  page: Page,
  options: SeedTreatmentOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedTreatment(opts);
  }, options);
}

/**
 * Fetches a Treatment (MedicationRequest) directly via the test bridge.
 */
export async function getTestTreatment(
  page: Page,
  id: string,
  patientId?: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async ({ treatId, patId }) => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.getTreatment(
        treatId,
        patId
      );
    },
    { treatId: id, patId: patientId }
  );
}

/** LOINC code of the consultation document section that lists treatments. */
export const TREATMENTS_SECTION_CODE = '10160-0';

/** Returns the treatments section of a consultation Composition, if any. */
export function findTreatmentsSection(document: any): any {
  return document?.section?.find((section: any) =>
    section.code?.coding?.some(
      (coding: any) => coding.code === TREATMENTS_SECTION_CODE
    )
  );
}
