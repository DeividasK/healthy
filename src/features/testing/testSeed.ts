import { test, type Page } from '@playwright/test';
import type { MedicationRequest, ServiceRequest } from 'fhir/r5';
import type {
  QuantityDraft,
  RegimenDraft,
} from '@/src/features/treatments/regimen';

export interface SeedPatientOptions {
  id?: string;
  givenName?: string;
  familyName?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
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
  serviceProviderName?: string;
  biomarkers: {
    name: string;
    value: number | string;
    unit?: string;
  }[];
}

export interface SeedConsultationOptions {
  reasonConditionIds?: string[];
  basedOnServiceRequestIds?: string[];
  id?: string;
  patientId?: string;
  conditionIds?: string[];
  title: string;
  doctorName?: string;
  serviceProviderName?: string;
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
  regimen?: RegimenDraft;
  dispenseQuantity?: QuantityDraft;
  reason?: string;
  reasonConditionIds?: string[];
  notes?: string;
  requesterName?: string;
}

export interface SeedServiceRequestOptions {
  id?: string;
  patientId?: string;
  consultationId?: string;
  title: string;
  /** SNOMED category code from SERVICE_REQUEST_CATEGORIES. */
  category?: string;
  intent?: ServiceRequest['intent'];
  status?: ServiceRequest['status'];
  authoredOn?: string;
  plannedDate?: string;
  instructions?: string;
  reason?: string;
  reasonConditionIds?: string[];
  notes?: string;
  requesterName?: string;
}

export interface SeedTreatmentLogOptions {
  treatmentId: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  answer: 'taken' | 'not-taken' | null;
  patientId?: string;
}

/** One browser round trip, ordered service writes, no concurrent SQLite transactions. */
export async function seedTestResources(
  page: Page,
  resources: {
    conditions?: SeedConditionOptions[];
    consultations?: SeedConsultationOptions[];
    treatments?: SeedTreatmentOptions[];
    serviceRequests?: SeedServiceRequestOptions[];
    treatmentLogs?: SeedTreatmentLogOptions[];
    reports?: SeedReportOptions[];
  }
): Promise<void> {
  await test.step('Seed related resources', async () => {
    await bootstrapApp(page);
    await page.evaluate(async (resources) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      for (const input of resources.conditions ?? [])
        await bridge.seedCondition(input);
      for (const input of resources.consultations ?? [])
        await bridge.seedConsultation(input);
      for (const input of resources.treatments ?? [])
        await bridge.seedTreatment(input);
      for (const input of resources.serviceRequests ?? [])
        await bridge.seedServiceRequest(input);
      for (const input of resources.treatmentLogs ?? [])
        await bridge.seedTreatmentLog(input);
      for (const input of resources.reports ?? [])
        await bridge.seedReport(input);
    }, resources);
  });
}

/** Boot once per page; subsequent seeds preserve the route under test. */
export async function bootstrapApp(page: Page): Promise<void> {
  await test.step('Bootstrap app and SQLite', async () => {
    if (page.url() === 'about:blank') await page.goto('/profile/new');
    await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  });
}

/** Seeds a Patient through the real service; a fresh page starts on Home. */
export async function seedTestPatient(
  page: Page,
  options?: SeedPatientOptions
): Promise<any> {
  const freshPage = page.url() === 'about:blank';
  await bootstrapApp(page);
  const patient = await test.step('Seed patient', () =>
    page.evaluate(async (opts) => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.seedPatient({
        id: opts?.id,
        givenName: opts?.givenName || 'John',
        familyName: opts?.familyName || 'Doe',
        gender: opts?.gender,
        birthDate: opts?.birthDate,
      });
    }, options));
  if (freshPage) {
    await page.getByTestId('cancel-button').waitFor();
    await page.getByTestId('app-home-button').click();
    await page.getByTestId('floating-add-button').waitFor();
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

/** Seeds service request (ServiceRequest) through the real service. */
export async function seedTestServiceRequest(
  page: Page,
  options: SeedServiceRequestOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedServiceRequest(
      opts
    );
  }, options);
}

/** Fetches stored service request (ServiceRequest) via the test bridge. */
export async function getTestServiceRequest(
  page: Page,
  id: string,
  patientId?: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async ({ requestId, patId }) =>
      await (window as any).__HEALTHY_TEST_BRIDGE__.getServiceRequest(
        requestId,
        patId
      ),
    { requestId: id, patId: patientId }
  );
}

/** Fetches a stored treatment log (MedicationAdministration) via the test bridge. */
export async function getTestTreatmentLog(
  page: Page,
  id: string,
  patientId?: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async ({ logId, patId }) =>
      await (window as any).__HEALTHY_TEST_BRIDGE__.getTreatmentLog(
        logId,
        patId
      ),
    { logId: id, patId: patientId }
  );
}

/** Local YYYY-MM-DD of the browser's today plus `delta` days. */
export async function getBrowserLocalDate(
  page: Page,
  delta = 0
): Promise<string> {
  return await page.evaluate((offset) => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  }, delta);
}

/** LOINC code of the consultation document section that lists service request. */
export const SERVICE_REQUESTS_SECTION_CODE = '18776-5';

/** Returns the service request section of a consultation Composition, if any. */
export function findServiceRequestSection(document: any): any {
  return document?.section?.find((section: any) =>
    section.code?.coding?.some(
      (coding: any) => coding.code === SERVICE_REQUESTS_SECTION_CODE
    )
  );
}

/** Runs a function against the test bridge inside the page. */
export const evaluateBridge = <T>(
  page: Page,
  run: (b: any, arg: any) => T | Promise<T>,
  arg?: unknown
): Promise<T> =>
  page.evaluate(
    ({ source, arg }) =>
      new Function('b', 'arg', `return (${source})(b, arg);`)(
        (window as any).__HEALTHY_TEST_BRIDGE__,
        arg
      ),
    { source: run.toString(), arg }
  );
